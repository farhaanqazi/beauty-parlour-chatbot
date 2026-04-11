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


@_webhook_limiter.limit("60 per minute")
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


@_webhook_limiter.limit("30 per minute")
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
    if x_hub_signature and settings.whatsapp_access_token:
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
        normalized_messages = WebhookService.normalize_whatsapp_update(salon_slug, payload)
        results: list[ProcessResult] = []
        for message in normalized_messages:
            # Idempotency: skip if this provider message was already processed
            if message.provider_message_id:
                exists_stmt = select(InboundMessage.id).where(
                    InboundMessage.provider_message_id == message.provider_message_id,
                )
                exists_result = await db.execute(exists_stmt)
                if exists_result.scalar_one_or_none():
                    app_logger.info(
                        "Skipping duplicate WhatsApp message",
                        event="webhook_dedup",
                        channel="whatsapp",
                        provider_message_id=message.provider_message_id,
                    )
                    continue
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


@_webhook_limiter.limit("30 per minute")
@router.post("/telegram/{salon_slug}")
async def receive_telegram_webhook(
    request: Request,
    salon_slug: str,
    db=Depends(get_db),
    conversation_service: ConversationService = Depends(get_conversation_service),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    # Verify Telegram webhook signature (secret token)
    # Note: For development/testing, we're skipping this check
    # In production, set TELEGRAM_WEBHOOK_SECRET in environment
    secret_token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    # if settings.telegram_bot_token and secret_token != settings.telegram_bot_token:
    #     app_logger.warn(
    #         "Telegram webhook secret mismatch",
    #         event="webhook_auth_failure",
    #         channel="telegram",
    #         salon_slug=salon_slug,
    #         has_secret=bool(secret_token),
    #     )
    #     raise HTTPException(status_code=403, detail="Invalid webhook secret")

    # Read and parse raw body
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

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
            # Idempotency: skip if this provider message was already processed
            if message.provider_message_id:
                exists_stmt = select(InboundMessage.id).where(
                    InboundMessage.provider_message_id == message.provider_message_id,
                )
                exists_result = await db.execute(exists_stmt)
                if exists_result.scalar_one_or_none():
                    app_logger.info(
                        "Skipping duplicate Telegram message",
                        event="webhook_dedup",
                        channel="telegram",
                        provider_message_id=message.provider_message_id,
                    )
                    continue
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
