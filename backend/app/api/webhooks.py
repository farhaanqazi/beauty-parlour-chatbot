from __future__ import annotations

import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select

from app.api.deps import get_app_settings, get_conversation_service, get_db
from app.core.config import Settings
from app.db.models.message import InboundMessage
from app.schemas.messages import ProcessResult
from app.services.conversation_service import ConversationService
from app.services.webhook_service import WebhookService
from app.utils.logger import app_logger

# Per-webhook rate limit: 60 per minute per IP (covers burst from Telegram/WhatsApp)
_webhook_limiter = Limiter(key_func=get_remote_address, default_limits=["60 per minute"])

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp/{salon_slug}")
async def verify_whatsapp_webhook(
    request: Request,
    salon_slug: str,
    mode: str | None = Query(default=None, alias="hub.mode"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
    settings: Settings = Depends(get_app_settings),
) -> str:
    del salon_slug
    if mode == "subscribe" and verify_token == settings.whatsapp_verify_token and challenge:
        app_logger.info(
            "WhatsApp webhook verified",
            event="webhook_verified",
            channel="whatsapp",
        )
        return challenge
    app_logger.warn(
        "WhatsApp webhook verification failed",
        event="webhook_verification_failure",
        channel="whatsapp",
        mode=mode,
        has_token=bool(verify_token),
    )
    raise HTTPException(status_code=403, detail="Webhook verification failed.")


@router.post("/whatsapp/{salon_slug}")
async def receive_whatsapp_webhook(
    request: Request,
    salon_slug: str,
    db=Depends(get_db),
    conversation_service: ConversationService = Depends(get_conversation_service),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    # Read raw body for signature verification
    raw_body = await request.body()
    
    # Verify WhatsApp webhook signature (HMAC-SHA256)
    x_hub_signature = request.headers.get("X-Hub-Signature-256", "")
    if settings.whatsapp_access_token:
        if not x_hub_signature:
            app_logger.warn(
                "WhatsApp webhook signature missing",
                event="webhook_auth_failure",
                channel="whatsapp",
                salon_slug=salon_slug,
            )
            raise HTTPException(status_code=403, detail="Missing webhook signature")
            
        expected_signature = "sha256=" + hmac.new(
            settings.whatsapp_access_token.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(x_hub_signature, expected_signature):
            app_logger.warn(
                "WhatsApp webhook signature mismatch",
                event="webhook_auth_failure",
                channel="whatsapp",
                salon_slug=salon_slug,
            )
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    # Parse JSON body manually (raw body already consumed)
    import json
    try:
        payload = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    app_logger.info(
        "WhatsApp webhook received",
        event="webhook_received",
        channel="whatsapp",
        salon_slug=salon_slug,
        message_count=len(payload.get("entry", [])),
    )
    try:
        from sqlalchemy import select as sa_select
        from app.db.models.salon import Salon as _Salon
        _salon_result = await db.execute(sa_select(_Salon).where(_Salon.slug == salon_slug))
        salon = _salon_result.scalar_one_or_none()
        if not salon:
            raise HTTPException(status_code=404, detail=f"Salon '{salon_slug}' not found.")

        normalized_messages = WebhookService.normalize_whatsapp_update(salon_slug, payload)
        results: list[ProcessResult] = []
        for message in normalized_messages:
            results.append(await conversation_service.handle_inbound(message))
        app_logger.info(
            "WhatsApp webhook processed",
            event="webhook_processed",
            channel="whatsapp",
            salon_slug=salon_slug,
            processed_count=len(results),
        )
        return {"processed": len(results), "results": [result.model_dump() for result in results]}
    except Exception as e:
        app_logger.error(
            "WhatsApp webhook failed",
            event="webhook_error",
            channel="whatsapp",
            salon_slug=salon_slug,
            error_type=type(e).__name__,
            error_message=str(e),
            exc_info=True,
        )
        raise


@router.post("/telegram/{salon_slug}")
async def receive_telegram_webhook(
    request: Request,
    salon_slug: str,
    db=Depends(get_db),
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> dict:
    # Resolve per-salon bot token from DB — no global fallback
    from sqlalchemy import select as sa_select
    from app.db.models.salon import Salon, SalonChannel
    from app.core.enums import ChannelType

    salon_result = await db.execute(
        sa_select(Salon).where(Salon.slug == salon_slug)
    )
    salon = salon_result.scalar_one_or_none()

    if not salon:
        raise HTTPException(status_code=404, detail=f"Salon '{salon_slug}' not found.")

    ch_result = await db.execute(
        sa_select(SalonChannel).where(
            SalonChannel.salon_id == salon.id,
            SalonChannel.channel == ChannelType.TELEGRAM,
        )
    )
    channel = ch_result.scalar_one_or_none()
    bot_token = (channel.provider_config or {}).get("bot_token") if channel else None

    if not bot_token:
        app_logger.error(
            "Telegram bot token not configured for salon",
            event="webhook_config_error",
            channel="telegram",
            salon_slug=salon_slug,
        )
        raise HTTPException(status_code=500, detail=f"Telegram channel not configured for salon '{salon_slug}'.")

    # Verify Telegram webhook secret token
    # secret_token was set as bot_token.replace(":", "_") during setWebhook
    secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    expected_secret = bot_token.replace(":", "_")

    if secret_token != expected_secret:
        app_logger.warn(
            "Telegram webhook secret mismatch",
            event="webhook_auth_failure",
            channel="telegram",
            salon_slug=salon_slug,
            has_secret=bool(secret_token),
        )
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    # Read and parse raw body
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Acknowledge callback queries immediately to stop the loading spinner
    callback_query = payload.get("callback_query")
    if callback_query and bot_token:
        callback_query_id = callback_query.get("id")
        if callback_query_id:
            import httpx
            import asyncio
            async def _answer_cb(token: str, cb_id: str, cb_data: str | None = None, cb_msg: dict | None = None):
                try:
                    cb_payload = {"callback_query_id": cb_id}
                    edit_req = None
                    if cb_data and cb_data.startswith("ignore_date_full"):
                        cb_payload["text"] = "This date is fully booked. Please choose an available date."
                        cb_payload["show_alert"] = True
                        
                        # Find the button and edit its text to highlight it was clicked
                        if cb_msg and "reply_markup" in cb_msg and "inline_keyboard" in cb_msg["reply_markup"]:
                            reply_markup = cb_msg["reply_markup"]
                            inline_keyboard = reply_markup["inline_keyboard"]
                            changed = False
                            for row in inline_keyboard:
                                for btn in row:
                                    if btn.get("callback_data") == cb_data and "⚠️" not in btn.get("text", ""):
                                        # Change emoji to highlight it
                                        old_text = btn["text"].replace("🚫 ", "")
                                        btn["text"] = f"⚠️ {old_text} ⚠️"
                                        changed = True
                            
                            if changed:
                                chat_id = cb_msg.get("chat", {}).get("id")
                                message_id = cb_msg.get("message_id")
                                if chat_id and message_id:
                                    edit_req = {
                                        "chat_id": chat_id,
                                        "message_id": message_id,
                                        "reply_markup": reply_markup
                                    }

                    async with httpx.AsyncClient() as client:
                        # Answer the callback query to stop the loading spinner and show the toast/alert
                        await client.post(
                            f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                            json=cb_payload,
                            timeout=5.0
                        )
                        # If we modified the button, update the message
                        if edit_req:
                            await client.post(
                                f"https://api.telegram.org/bot{token}/editMessageReplyMarkup",
                                json=edit_req,
                                timeout=5.0
                            )
                except Exception as e:
                    app_logger.warning(f"Failed to answer callback query: {e}")
            
            asyncio.create_task(_answer_cb(bot_token, callback_query_id, callback_query.get("data"), callback_query.get("message")))

    app_logger.info(
        "Telegram webhook received",
        event="webhook_received",
        channel="telegram",
        salon_slug=salon_slug,
        message_count=len(payload.get("entry", [])),
    )
    try:
        normalized_messages = WebhookService.normalize_telegram_update(salon_slug, payload)
        results: list[ProcessResult] = []
        for message in normalized_messages:
            results.append(await conversation_service.handle_inbound(message))
        app_logger.info(
            "Telegram webhook processed",
            event="webhook_processed",
            channel="telegram",
            salon_slug=salon_slug,
            processed_count=len(results),
        )
        return {"processed": len(results), "results": [result.model_dump() for result in results]}
    except Exception as e:
        app_logger.error(
            "Telegram webhook failed",
            event="webhook_error",
            channel="telegram",
            salon_slug=salon_slug,
            error_type=type(e).__name__,
            error_message=str(e),
            exc_info=True,
        )
        raise
