from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import get_db, get_notification_service, get_current_user, AuthenticatedUser
from app.core.enums import AppointmentStatus, NotificationJobType
from app.db.models.appointment import Appointment, NotificationJob
from app.schemas.appointments import CancelAppointmentRequest
from app.services.appointment_service import AppointmentService
from app.services.notification_service import NotificationService
from app.services.tenant_service import TenantService


router = APIRouter(tags=["appointments"])


@router.get("/appointments")
async def list_appointments(
    salon_id: UUID = Query(...),
    date_from: datetime = Query(...),
    date_to: datetime = Query(...),
    status: str = Query(None),
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    """
    List appointments with filtering options.
    
    Admin access required.
    """
    # Authorization: only admins can access this endpoint
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions.",
        )

    statement = select(Appointment).options(joinedload(Appointment.customer)).where(Appointment.salon_id == salon_id)
    
    # Date range filter
    statement = statement.where(
        Appointment.appointment_at >= date_from,
        Appointment.appointment_at <= date_to,
    )
    
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

    statement = statement.order_by(Appointment.appointment_at)
    result = await db.execute(statement)
    appointments = result.scalars().unique().all()

    data = [
        {
            "id": str(appt.id),
            "booking_reference": appt.booking_reference,
            "service": appt.service_name_snapshot,
            "customer": appt.customer.display_name if appt.customer else None,
            "appointment_at": appt.appointment_at.isoformat(),
            "status": appt.status.value,
        }
        for appt in appointments
    ]

    return {"data": data, "total": len(data)}


@router.get("/salons/{salon_identifier}/appointments/upcoming")
async def list_upcoming_appointments(
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
                "customer": appointment.customer.display_name if appointment.customer else None,
                "appointment_at": appointment.appointment_at.isoformat(),
                "status": appointment.status.value,
            }
            for appointment in appointments
        ],
    }


@router.post("/appointments/{appointment_id}/cancel")
async def cancel_appointment(
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
