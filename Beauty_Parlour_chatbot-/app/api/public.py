from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional

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


@router.get("/debug/jwt-decode")
async def debug_jwt_decode(
    authorization: Optional[str] = Header(default=None),
    settings: Settings = Depends(get_app_settings),
) -> dict:
    """Debug endpoint to diagnose JWT verification failures."""
    import base64
    from jose import jwt, JWTError, ExpiredSignatureError

    if not authorization or not authorization.startswith("Bearer "):
        return {
            "error": "No Bearer token provided",
            "hint": "Send Authorization: Bearer <token> header",
        }

    token = authorization.split(" ", 1)[1]

    # Decode the token header to see what's in it
    try:
        header_b64 = token.split(".")[0]
        # Add padding if needed
        padding = 4 - len(header_b64) % 4
        if padding != 4:
            header_b64 += "=" * padding
        header = base64.urlsafe_b64decode(header_b64).decode("utf-8")
    except Exception as e:
        header = f"Failed to decode: {e}"

    # Decode the token payload to see what's in it
    try:
        payload_b64 = token.split(".")[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload_raw = base64.urlsafe_b64decode(payload_b64).decode("utf-8")
    except Exception as e:
        payload_raw = f"Failed to decode: {e}"

    # Try to verify the JWT with HS256
    result = {
        "token_length": len(token),
        "jwt_secret_configured": settings.supabase_jwt_secret[:10] + "..." if settings.supabase_jwt_secret else "NOT SET",
        "token_header": header,
        "token_payload_raw": payload_raw,
    }

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        result["verification"] = "SUCCESS"
        result["decoded_payload"] = payload
    except ExpiredSignatureError:
        result["verification"] = "FAILED: Token expired"
    except JWTError as e:
        result["verification"] = f"FAILED: {str(e)}"
        result["hint"] = "If this says 'Invalid signature', the SUPABASE_JWT_SECRET in your backend .env does not match the key Supabase used to sign the token. Go to Supabase Dashboard → Project Settings → API → JWT Settings and copy the exact secret."
    except Exception as e:
        result["verification"] = f"FAILED: {type(e).__name__}: {e}"

    return result
