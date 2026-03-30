from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from app.api.deps import get_db, get_notification_service, get_current_user, AuthenticatedUser
from app.core.enums import NotificationJobType
from app.db.models.appointment import NotificationJob
from app.schemas.appointments import CancelAppointmentRequest
from app.services.appointment_service import AppointmentService
from app.services.notification_service import NotificationService
from app.services.tenant_service import TenantService


router = APIRouter(tags=["appointments"])


@router.get("/salons/{salon_slug}/appointments/upcoming")
async def list_upcoming_appointments(
    salon_slug: str,
    hours: int = Query(default=24, ge=1, le=168),
    db=Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    tenant_service = TenantService(db)
    appointment_service = AppointmentService(db)
    salon = await tenant_service.get_salon_by_slug(salon_slug)
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found.")

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
