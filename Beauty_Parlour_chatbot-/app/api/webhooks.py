from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_app_settings, get_conversation_service
from app.core.config import Settings
from app.schemas.messages import ProcessResult
from app.services.conversation_service import ConversationService
from app.services.webhook_service import WebhookService


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp/{salon_slug}")
async def verify_whatsapp_webhook(
    salon_slug: str,
    mode: str | None = Query(default=None, alias="hub.mode"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
    settings: Settings = Depends(get_app_settings),
) -> str:
    del salon_slug
    if mode == "subscribe" and verify_token == settings.whatsapp_verify_token and challenge:
        return challenge
    raise HTTPException(status_code=403, detail="Webhook verification failed.")


@router.post("/whatsapp/{salon_slug}")
async def receive_whatsapp_webhook(
    salon_slug: str,
    payload: dict,
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> dict:
    normalized_messages = WebhookService.normalize_whatsapp_update(salon_slug, payload)
    results: list[ProcessResult] = []
    for message in normalized_messages:
        results.append(await conversation_service.handle_inbound(message))
    return {"processed": len(results), "results": [result.model_dump() for result in results]}


@router.post("/telegram/{salon_slug}")
async def receive_telegram_webhook(
    salon_slug: str,
    payload: dict,
    conversation_service: ConversationService = Depends(get_conversation_service),
) -> dict:
    normalized_messages = WebhookService.normalize_telegram_update(salon_slug, payload)
    results: list[ProcessResult] = []
    for message in normalized_messages:
        results.append(await conversation_service.handle_inbound(message))
    return {"processed": len(results), "results": [result.model_dump() for result in results]}
