from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import get_db, get_current_user, require_roles, AuthenticatedUser
from app.db.models.salon import Salon, SalonService, SalonChannel
from app.services.tenant_service import TenantService


router = APIRouter(tags=["salons"])


@router.get("/salons")
async def list_salons(
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


@router.get("/salons/{salon_id}")
async def get_salon(
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


@router.get("/salons/{salon_slug}/details")
async def get_salon_by_slug(salon_slug: str, db=Depends(get_db)) -> dict:
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
