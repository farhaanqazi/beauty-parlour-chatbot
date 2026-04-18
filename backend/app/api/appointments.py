

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select, or_
from sqlalchemy.orm import joinedload, contains_eager

from app.api.deps import get_db, get_notification_service, get_current_user, require_roles, AuthenticatedUser
from app.core.enums import AppointmentStatus, NotificationJobType
from app.db.models.appointment import Appointment, NotificationJob
from app.db.models.customer import Customer
from app.db.models.salon import Salon, SalonService
from app.db.models.common import utc_now
from app.schemas.appointments import CancelAppointmentRequest
from app.services.appointment_service import AppointmentService
from app.services.notification_service import NotificationService
from app.services.tenant_service import TenantService
from app.utils.logger import app_logger
from app.middleware.rate_limiter import limiter as shared_limiter

# Strict rate limit on appointment creation: 10 per minute per IP
_appointment_limiter = Limiter(key_func=get_remote_address, default_limits=["100 per hour"])

router = APIRouter(tags=["appointments"])


class CreateAppointmentRequest(BaseModel):
    salon_id: str
    customer_id: str
    customer_name: str
    service_id: str
    appointment_at: str
    notes: str | None = None


class UpdateStatusRequest(BaseModel):
    status: str


@router.get("/appointments")
@shared_limiter.limit("200 per minute")
async def list_appointments(
    request: Request,
    salon_id: str = Query(...),
    date_from: datetime = Query(None),
    date_to: datetime = Query(None),
    status: str = Query(None),
    search: str = Query(None),
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """
    List appointments with filtering options.
    
    Admin access required.
    """
    # Authorization: Admins see any salon, Owners/Reception see only their assigned salon
    if current_user.role not in ["admin", "salon_owner", "reception"]:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions.",
        )
    
    # Verify salon_id matches user's salon for non-admins
    if current_user.role != "admin" and salon_id != current_user.salon_id:
        raise HTTPException(
            status_code=403,
            detail="Access restricted to your assigned salon.",
        )

    # Main query with explicit join for filtering and loading
    statement = (
        select(Appointment)
        .join(Customer)
        .options(contains_eager(Appointment.customer))
        .where(Appointment.salon_id == salon_id)
    )
    
    # Date range filter
    if date_from:
        statement = statement.where(Appointment.appointment_at >= date_from)
    if date_to:
        statement = statement.where(Appointment.appointment_at <= date_to)
    
    # Status filter
    if status:
        try:
            status_enum = AppointmentStatus(status.lower())
            statement = statement.where(Appointment.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {[s.value for s in AppointmentStatus]}",
            )

    # Search filter
    if search:
        search_term = f"%{search}%"
        statement = statement.where(
            or_(
                Customer.display_name.ilike(search_term),
                Appointment.service_name_snapshot.ilike(search_term),
                Appointment.booking_reference.ilike(search_term),
            )
        )

    statement = statement.order_by(Appointment.appointment_at)
    result = await db.execute(statement)
    appointments = result.scalars().unique().all()

    data = [
        {
            "id": str(appt.id),
            "booking_reference": appt.booking_reference,
            "service": appt.service_name_snapshot,
            "customer": appt.customer.display_name if appt.customer else "Unknown",
            "appointment_at": appt.appointment_at.isoformat(),
            "status": appt.status.value,
            "final_price": float(appt.final_price) if appt.final_price else 0,
        }
        for appt in appointments
    ]

    return {"data": data, "total": len(data)}


@_appointment_limiter.limit("10 per minute")
@router.post("/appointments")
async def create_appointment(
    request: Request,
    payload: CreateAppointmentRequest,
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles("admin", "salon_owner", "reception")),
) -> dict:
    """
    Create a new appointment (for dashboard users).
    Admin, salon owner, and reception access.
    """
    import random
    import string
    from datetime import datetime as dt
    from zoneinfo import ZoneInfo

    # Validate salon exists and user has access
    salon_stmt = select(Salon).where(Salon.id == UUID(payload.salon_id))
    salon_result = await db.execute(salon_stmt)
    salon = salon_result.scalar_one_or_none()

    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    # Tenant isolation: non-admin users can only create appointments for their own salon
    if current_user.role != "admin" and str(salon.id) != current_user.salon_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this salon.",
        )

    # Validate service exists
    service_stmt = select(SalonService).where(
        SalonService.id == UUID(payload.service_id),
        SalonService.salon_id == salon.id,
    )
    service_result = await db.execute(service_stmt)
    service = service_result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found for this salon.")

    # Parse appointment time
    try:
        appointment_at = dt.fromisoformat(payload.appointment_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format.")

    # Generate booking reference
    booking_reference = "BK" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

    # Find customer by external_user_id (the value typed by user)
    customer_stmt = select(Customer).where(
        Customer.salon_id == salon.id,
        Customer.channel == "whatsapp",
        Customer.external_user_id == payload.customer_id,
    )
    customer_result = await db.execute(customer_stmt)
    customer = customer_result.scalar_one_or_none()

    if not customer:
        # Create a new customer with auto-generated UUID
        try:
            customer = Customer(
                salon_id=salon.id,
                channel="whatsapp",
                external_user_id=payload.customer_id,
                display_name=payload.customer_name,
            )
            db.add(customer)
            await db.flush()
        except Exception as e:
            await db.rollback()
            # Handle race condition where customer was just created
            customer_stmt = select(Customer).where(
                Customer.salon_id == salon.id,
                Customer.channel == "whatsapp",
                Customer.external_user_id == payload.customer_id,
            )
            customer_result = await db.execute(customer_stmt)
            customer = customer_result.scalar_one_or_none()
            if not customer:
                raise HTTPException(status_code=500, detail="Failed to create customer.")

    # Create appointment
    appointment = Appointment(
        salon_id=salon.id,
        customer_id=customer.id,
        service_id=service.id,
        booking_reference=booking_reference,
        channel="whatsapp",
        status=AppointmentStatus.CONFIRMED,
        language=salon.default_language or "en",
        marriage_type="Unknown",
        service_name_snapshot=service.name,
        appointment_at=appointment_at,
        notes=payload.notes,
        confirmed_at=utc_now(),
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    app_logger.info(
        "Appointment created via dashboard",
        event="appointment_created",
        booking_reference=appointment.booking_reference,
        customer_id=str(customer.id),
        salon_id=str(salon.id),
    )

    return {
        "id": str(appointment.id),
        "booking_reference": appointment.booking_reference,
        "status": appointment.status.value,
        "appointment_at": appointment.appointment_at.isoformat(),
    }


@router.get("/salons/{salon_identifier}/appointments/all")
@shared_limiter.limit("200 per minute")
async def list_all_salon_appointments(
    request: Request,
    salon_identifier: str,
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """
    List ALL appointments for a salon (historic + future).
    """
    tenant_service = TenantService(db)

    salon = None
    try:
        salon_id = UUID(salon_identifier)
        salon = await tenant_service.get_salon_by_id(salon_id)
    except ValueError:
        salon = await tenant_service.get_salon_by_slug(salon_identifier)

    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    # Tenant isolation
    if current_user.role != "admin" and str(salon.id) != current_user.salon_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this salon's appointments.",
        )

    from sqlalchemy import desc

    statement = (
        select(Appointment)
        .options(joinedload(Appointment.customer), joinedload(Appointment.service))
        .where(Appointment.salon_id == salon.id)
        .order_by(desc(Appointment.appointment_at))
    )
    result = await db.execute(statement)
    appointments = result.scalars().unique().all()

    # Statuses that represent a still-active booking.
    # If the appointment time has already passed and the status is one of
    # these, we treat it as 'completed' in the response without persisting
    # the change (the DB trigger / migration_v4 handles the real update).
    _auto_complete_statuses = {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.PENDING,
        AppointmentStatus.IN_PROGRESS,
    }
    now_utc = datetime.now(timezone.utc)

    def _effective_status(apt: Appointment) -> str:
        appt_time = apt.appointment_at
        # Make timezone-aware if the stored value is naive
        if appt_time.tzinfo is None:
            appt_time = appt_time.replace(tzinfo=timezone.utc)
        if appt_time < now_utc and apt.status in _auto_complete_statuses:
            return AppointmentStatus.COMPLETED.value
        return apt.status.value

    return {
        "appointments": [
            {
                "id": str(appointment.id),
                "booking_reference": appointment.booking_reference,
                "service_name": appointment.service_name_snapshot,
                "customer_id": str(appointment.customer_id) if appointment.customer_id else None,
                "customer_name": appointment.customer.display_name if appointment.customer else "Unknown",
                "appointment_at": appointment.appointment_at.isoformat(),
                "status": _effective_status(appointment),
                "final_price": float(appointment.final_price) if appointment.final_price else (
                    float(appointment.service.price) if appointment.service and appointment.service.price else 0
                ),
            }
            for appointment in appointments
        ],
    }


@router.get("/salons/{salon_identifier}/appointments/upcoming")
@shared_limiter.limit("200 per minute")
async def list_upcoming_appointments(
    request: Request,
    salon_identifier: str,
    hours: int = Query(default=24, ge=1, le=168),
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    tenant_service = TenantService(db)
    
    # Try to resolve as UUID first, then as slug
    salon = None
    try:
        salon_id = UUID(salon_identifier)
        salon = await tenant_service.get_salon_by_id(salon_id)
    except ValueError:
        salon = await tenant_service.get_salon_by_slug(salon_identifier)
    
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

    # Tenant isolation: non-admin users can only view appointments for their own salon
    if current_user.role != "admin" and str(salon.id) != current_user.salon_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this salon's appointments.",
        )

    appointment_service = AppointmentService(db)
    appointments = await appointment_service.list_upcoming_appointments(salon.id, hours=hours)
    return {
        "salon": salon.slug,
        "appointments": [
            {
                "id": str(appointment.id),
                "booking_reference": appointment.booking_reference,
                "service": appointment.service_name_snapshot,
                "customer_id": str(appointment.customer_id) if appointment.customer_id else None,
                "customer": appointment.customer.display_name if appointment.customer else None,
                "appointment_at": appointment.appointment_at.isoformat(),
                "status": appointment.status.value,
                "final_price": float(appointment.final_price) if appointment.final_price else 0,
            }
            for appointment in appointments
        ],
    }


@router.patch("/appointments/{appointment_id}/status")
@shared_limiter.limit("60 per minute")
async def update_appointment_status(
    request: Request,
    appointment_id: UUID,
    payload: UpdateStatusRequest,
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """Update the status of a single appointment (admin, salon_owner, reception).

    Accepts both full enum values (e.g. 'cancelled_by_salon') and the simplified
    UI labels ('pending', 'confirmed', 'completed', 'cancelled'). The simplified
    'cancelled' maps to 'cancelled_by_salon' since this action is performed by staff.
    """
    # Map simplified UI labels to canonical enum values
    _ui_to_enum: dict[str, str] = {
        "cancelled": AppointmentStatus.CANCELLED_BY_SALON.value,
    }
    resolved_status = _ui_to_enum.get(payload.status, payload.status)

    allowed_statuses = {s.value for s in AppointmentStatus}
    if resolved_status not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{payload.status}'. Allowed: pending, confirmed, completed, cancelled.",
        )

    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Tenant isolation: admins can update any appointment; others only within their salon
    if current_user.role != "admin" and str(appointment.salon_id) != current_user.salon_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to update appointments for this salon.",
        )

    appointment.status = AppointmentStatus(resolved_status)
    await db.commit()
    await db.refresh(appointment)

    app_logger.info(
        "Appointment status updated",
        event="appointment_status_updated",
        appointment_id=str(appointment_id),
        new_status=resolved_status,
        updated_by=current_user.user_id,
    )
    return {
        "appointment_id": str(appointment.id),
        "booking_reference": appointment.booking_reference,
        "status": appointment.status.value,
    }


@router.post("/appointments/{appointment_id}/cancel")
@shared_limiter.limit("20 per minute")
async def cancel_appointment(
    request: Request,
    appointment_id: UUID,
    payload: CancelAppointmentRequest,
    db=Depends(get_db),
    notification_service: NotificationService = Depends(get_notification_service),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    # Tenant isolation: verify user has access to this appointment's salon
    appt_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Admins can cancel any appointment; others only within their salon
    if current_user.role != "admin" and str(appointment.salon_id) != current_user.salon_id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to cancel appointments for this salon.",
        )

    appointment_service = AppointmentService(db)
    appointment = await appointment_service.cancel_appointment(
        appointment_id=appointment_id,
        salon_id=appointment.salon_id,
        reason=payload.reason,
        cancelled_by=payload.cancelled_by,
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    await db.commit()
    result = await db.execute(
        select(NotificationJob.id).where(
            NotificationJob.appointment_id == appointment.id,
            NotificationJob.job_type == NotificationJobType.CUSTOMER_CANCELLATION,
        )
    )
    pending_job_ids = [job_id for job_id in result.scalars().all()]
    if pending_job_ids:
        await notification_service.process_job_ids(pending_job_ids)
    return {
        "appointment_id": str(appointment.id),
        "booking_reference": appointment.booking_reference,
        "status": appointment.status.value,
    }
