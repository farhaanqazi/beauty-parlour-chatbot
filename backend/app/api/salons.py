import asyncio
import re
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import get_db, get_app_settings, require_roles, AuthenticatedUser
from app.core.config import Settings
from app.core.enums import ChannelType
from app.db.models.salon import Salon, SalonService, SalonChannel
from app.services.tenant_service import TenantService
from app.middleware.rate_limiter import limiter as shared_limiter
from app.utils.logger import app_logger


router = APIRouter(tags=["salons"])


class CreateSalonRequest(BaseModel):
    name: str
    slug: str
    timezone: str = "Asia/Kolkata"
    default_language: str = "english"
    telegram_bot_token: Optional[str] = None
    telegram_bot_username: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Salon name cannot be empty")
        return v

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', v) and len(v) >= 2:
            raise ValueError("Slug must be lowercase letters, numbers, and hyphens (no leading/trailing hyphens)")
        return v

    @field_validator("telegram_bot_token")
    @classmethod
    def clean_token(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            return v if v else None
        return None

    @field_validator("telegram_bot_username")
    @classmethod
    def clean_username(cls, v: Optional[str]) -> Optional[str]:
        if v:
            v = v.strip()
            if v and not v.startswith("@"):
                v = f"@{v}"
            return v if v else None
        return None


@router.get("/salons")
@shared_limiter.limit("200 per minute")
async def list_salons(
    request: Request,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    List all active salons.

    Returns salon details including services and channels.
    Admin access only.
    """
    statement = (
        select(Salon)
        .options(
            joinedload(Salon.services),
            joinedload(Salon.channels),
        )
        .where(Salon.is_active.is_(True))
        .order_by(Salon.name)
    )
    result = await db.execute(statement)
    salons = result.scalars().unique().all()
    
    data = [
        {
            "id": str(salon.id),
            "name": salon.name,
            "slug": salon.slug,
            "timezone": salon.timezone,
            "default_language": salon.default_language,
            "is_active": salon.is_active,
            "services_count": len([s for s in salon.services if s.is_active]),
            "channels": [
                {"channel": ch.channel.value if hasattr(ch.channel, 'value') else ch.channel, "is_enabled": ch.is_enabled}
                for ch in salon.channels
            ],
            "created_at": salon.created_at.isoformat() if salon.created_at else None,
        }
        for salon in salons
    ]
    
    return {"data": data, "total": len(data)}


@shared_limiter.limit("20 per minute")
@router.post("/salons", status_code=201)
async def create_salon(
    request: Request,
    payload: CreateSalonRequest,
    db=Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    user: AuthenticatedUser = Depends(require_roles("admin")),
) -> dict:
    """
    Create a new salon.

    Admin access only. If a Telegram bot token is provided, the channel row
    is created and the webhook is registered with Telegram automatically.
    """
    # Ensure slug is unique
    existing = await db.execute(select(Salon).where(Salon.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A salon with this slug already exists.")

    # Create the salon
    salon = Salon(
        name=payload.name,
        slug=payload.slug,
        timezone=payload.timezone,
        default_language=payload.default_language,
    )
    db.add(salon)
    await db.flush()  # get salon.id without committing yet

    telegram_status = None
    telegram_token = payload.telegram_bot_token
    telegram_username = payload.telegram_bot_username
    salon_slug = payload.slug

    # Optionally wire up Telegram channel in DB (but NOT the webhook yet)
    if telegram_token:
        channel = SalonChannel(
            salon_id=salon.id,
            channel=ChannelType.TELEGRAM,
            is_enabled=True,
            inbound_identifier=telegram_username,
            provider_config={"bot_token": telegram_token},
        )
        db.add(channel)

    # Commit the salon and channel first
    await db.commit()
    await db.refresh(salon)

    # Now register the webhook with Telegram in background (non-blocking)
    if telegram_token:
        async def register_telegram_webhook():
            """Background task to register Telegram webhook without blocking the response."""
            webhook_url = f"{settings.webhook_base_url}/api/v1/webhooks/telegram/{salon_slug}"
            secret_token = telegram_token.replace(":", "_")
            try:
                http_client = request.app.state.http_client
                if not http_client:
                    app_logger.warning(
                        "Telegram webhook registration skipped - HTTP client not available",
                        event="telegram_webhook_skipped",
                        salon_slug=salon_slug,
                    )
                    return

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{telegram_token}/setWebhook",
                        json={"url": webhook_url, "secret_token": secret_token},
                        timeout=10.0,
                    )
                    tg_data = resp.json()
                    if tg_data.get("ok"):
                        app_logger.info(
                            "Telegram webhook registered",
                            event="telegram_webhook_registered",
                            salon_slug=salon_slug,
                            webhook_url=webhook_url,
                        )
                    else:
                        app_logger.warning(
                            "Telegram webhook registration failed",
                            event="telegram_webhook_failed",
                            salon_slug=salon_slug,
                            description=tg_data.get("description"),
                        )
            except httpx.TimeoutException:
                app_logger.warning(
                    "Telegram webhook registration timed out",
                    event="telegram_webhook_timeout",
                    salon_slug=salon_slug,
                )
            except Exception as e:
                app_logger.error(
                    "Telegram webhook registration error",
                    event="telegram_webhook_error",
                    salon_slug=salon_slug,
                    error=str(e),
                )

        # Fire and forget - don't wait for webhook registration
        asyncio.create_task(register_telegram_webhook())
        telegram_status = "registering"  # Indicate it's in progress

    return {
        "id": str(salon.id),
        "name": salon.name,
        "slug": salon.slug,
        "timezone": salon.timezone,
        "default_language": salon.default_language,
        "is_active": salon.is_active,
        "services_count": 0,
        "telegram_status": telegram_status,
        "created_at": salon.created_at.isoformat() if salon.created_at else None,
    }


@router.get("/salons/{salon_id}")
@shared_limiter.limit("200 per minute")
async def get_salon(
    request: Request,
    salon_id: UUID,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin", "salon_owner", "reception")),
) -> dict:
    """
    Get a single salon by ID with full details.
    Admin, salon owner, and reception access.
    """
    statement = (
        select(Salon)
        .options(
            joinedload(Salon.services),
            joinedload(Salon.channels),
            joinedload(Salon.contacts),
        )
        .where(Salon.id == salon_id)
    )
    result = await db.execute(statement)
    salon = result.unique().scalar_one_or_none()
    
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")
    
    return {
        "id": str(salon.id),
        "name": salon.name,
        "slug": salon.slug,
        "timezone": salon.timezone,
        "default_language": salon.default_language,
        "is_active": salon.is_active,
        "flow_config": salon.flow_config,
        "entry_config": salon.entry_config,
        "services": [
            {
                "id": str(service.id),
                "code": service.code,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_minutes,
                "price": float(service.price) if service.price is not None else None,
                "is_active": service.is_active,
                "sample_image_urls": service.sample_image_urls,
            }
            for service in salon.services
        ],
        "channels": [
            {
                "id": str(ch.id),
                "channel": ch.channel.value if hasattr(ch.channel, 'value') else ch.channel,
                "is_enabled": ch.is_enabled,
                "inbound_identifier": ch.inbound_identifier,
            }
            for ch in salon.channels
        ],
        "contacts": [
            {
                "id": str(contact.id),
                "name": contact.name,
                "channel": contact.channel.value if hasattr(contact.channel, 'value') else contact.channel,
                "destination": contact.destination,
                "is_active": contact.is_active,
            }
            for contact in salon.contacts
        ],
        "created_at": salon.created_at.isoformat() if salon.created_at else None,
        "updated_at": salon.updated_at.isoformat() if salon.updated_at else None,
    }


class CreateServiceRequest(BaseModel):
    name: str
    code: str
    duration_minutes: int
    price: float
    description: Optional[str] = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Service name cannot be empty")
        return v

    @field_validator("code")
    @classmethod
    def code_not_empty(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("Service code cannot be empty")
        return v

    @field_validator("duration_minutes")
    @classmethod
    def duration_positive(cls, v: int) -> int:
        if v < 5:
            raise ValueError("Duration must be at least 5 minutes")
        if v > 480:
            raise ValueError("Duration cannot exceed 480 minutes (8 hours)")
        return v

    @field_validator("price")
    @classmethod
    def price_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Price cannot be negative")
        return v


class UpdateServiceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    is_active: Optional[bool] = None

    @field_validator("duration_minutes")
    @classmethod
    def duration_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 5:
            raise ValueError("Duration must be at least 5 minutes")
        return v

    @field_validator("price")
    @classmethod
    def price_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Price cannot be negative")
        return v


@router.post("/salons/{salon_id}/services", status_code=201)
@shared_limiter.limit("60 per minute")
async def create_service(
    request: Request,
    salon_id: UUID,
    payload: CreateServiceRequest,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin", "salon_owner")),
) -> dict:
    """
    Create a new service for a salon.

    Salon owners can only create services for their own salon.
    Admins can create services for any salon.
    """
    # Tenant isolation: salon_owner can only manage their own salon
    if user.role == "salon_owner" and str(user.salon_id) != str(salon_id):
        raise HTTPException(status_code=403, detail="You can only manage services for your own salon.")

    # Verify salon exists
    salon_result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = salon_result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    # Check code uniqueness within the salon
    existing = await db.execute(
        select(SalonService).where(
            SalonService.salon_id == salon_id,
            SalonService.code == payload.code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A service with code '{payload.code}' already exists in this salon.",
        )

    service = SalonService(
        salon_id=salon_id,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        is_active=payload.is_active,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)

    return {
        "id": str(service.id),
        "code": service.code,
        "name": service.name,
        "description": service.description,
        "duration_minutes": service.duration_minutes,
        "price": float(service.price) if service.price is not None else None,
        "is_active": service.is_active,
        "created_at": service.created_at.isoformat() if service.created_at else None,
    }


@router.patch("/salons/{salon_id}/services/{service_id}")
@shared_limiter.limit("60 per minute")
async def update_service(
    request: Request,
    salon_id: UUID,
    service_id: UUID,
    payload: UpdateServiceRequest,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin", "salon_owner")),
) -> dict:
    """
    Update an existing salon service.

    Salon owners can only update services for their own salon.
    """
    if user.role == "salon_owner" and str(user.salon_id) != str(salon_id):
        raise HTTPException(status_code=403, detail="You can only manage services for your own salon.")

    result = await db.execute(
        select(SalonService).where(
            SalonService.id == service_id,
            SalonService.salon_id == salon_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")

    if payload.name is not None:
        service.name = payload.name.strip()
    if payload.description is not None:
        service.description = payload.description
    if payload.duration_minutes is not None:
        service.duration_minutes = payload.duration_minutes
    if payload.price is not None:
        service.price = payload.price
    if payload.is_active is not None:
        service.is_active = payload.is_active

    await db.commit()
    await db.refresh(service)

    return {
        "id": str(service.id),
        "code": service.code,
        "name": service.name,
        "description": service.description,
        "duration_minutes": service.duration_minutes,
        "price": float(service.price) if service.price is not None else None,
        "is_active": service.is_active,
    }


@router.delete("/salons/{salon_id}/services/{service_id}")
@shared_limiter.limit("30 per minute")
async def delete_service(
    request: Request,
    salon_id: UUID,
    service_id: UUID,
    db=Depends(get_db),
    user: AuthenticatedUser = Depends(require_roles("admin", "salon_owner")),
) -> Response:
    """
    Delete a salon service.

    Salon owners can only delete services for their own salon.
    """
    if user.role == "salon_owner" and str(user.salon_id) != str(salon_id):
        raise HTTPException(status_code=403, detail="You can only manage services for your own salon.")

    result = await db.execute(
        select(SalonService).where(
            SalonService.id == service_id,
            SalonService.salon_id == salon_id,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found.")

    await db.delete(service)
    await db.commit()
    return Response(status_code=204)


@router.get("/salons/{salon_slug}/details")
@shared_limiter.limit("200 per minute")
async def get_salon_by_slug(request: Request, salon_slug: str, db=Depends(get_db)) -> dict:
    """
    Get salon details by slug (public endpoint for chatbot).
    """
    tenant_service = TenantService(db)
    salon = await tenant_service.get_salon_by_slug(salon_slug)
    
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")
    
    return {
        "id": str(salon.id),
        "name": salon.name,
        "slug": salon.slug,
        "timezone": salon.timezone,
        "default_language": salon.default_language,
        "services": [
            {
                "id": str(service.id),
                "code": service.code,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_minutes,
            }
            for service in salon.services
            if service.is_active
        ],
    }
