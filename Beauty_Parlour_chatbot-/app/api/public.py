from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_app_settings, get_db
from app.core.config import Settings
from app.core.enums import ChannelType
from app.services.tenant_service import TenantService


router = APIRouter(tags=["public"])


@router.get("/salons/{salon_slug}/entry-links")
async def get_entry_links(
    salon_slug: str,
    db=Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    tenant_service = TenantService(db)
    salon = await tenant_service.get_salon_by_slug(salon_slug)
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    telegram_channel = tenant_service.get_channel_config(salon, ChannelType.TELEGRAM)
    whatsapp_channel = tenant_service.get_channel_config(salon, ChannelType.WHATSAPP)

    telegram_bot_name = None
    if telegram_channel:
        telegram_bot_name = telegram_channel.provider_config.get("bot_name") or settings.telegram_bot_name

    whatsapp_number = None
    if whatsapp_channel:
        whatsapp_number = (
            whatsapp_channel.provider_config.get("business_phone")
            or salon.entry_config.get("whatsapp_number")
            or ""
        )

    telegram_link = (
        f"https://t.me/{telegram_bot_name}?start={salon.slug}" if telegram_bot_name else None
    )
    whatsapp_link = f"https://wa.me/{whatsapp_number}?text=Hi" if whatsapp_number else None

    return {
        "salon": salon.slug,
        "telegram_link": telegram_link,
        "whatsapp_link": whatsapp_link,
        "note": "Use either deep link as the source value for a QR code.",
    }
