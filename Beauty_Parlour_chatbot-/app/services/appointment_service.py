from __future__ import annotations

import logging
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.enums import AppointmentStatus, NotificationJobType
from app.db.models.appointment import Appointment, NotificationJob
from app.db.models.customer import Customer
from app.db.models.salon import Salon, SalonService
from app.db.models.common import utc_now
from app.schemas.state import ConversationState


logger = logging.getLogger(__name__)


class AppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_appointment(
        self,
        salon: Salon,
        customer: Customer,
        state: ConversationState,
    ) -> Appointment:
        """
        Create an appointment with proper transaction handling.
        
        If any step fails (validation, service lookup, notification scheduling),
        the entire transaction is rolled back to prevent partial data.
        """
        if not state.slots.service_id or not state.slots.appointment_date or not state.slots.appointment_time:
            raise ValueError("Conversation state is missing appointment details.")

        service = await self._get_service(UUID(state.slots.service_id))
        if not service:
            raise ValueError("Selected service does not exist.")

        try:
            appointment_at = datetime.combine(
                state.slots.appointment_date,
                state.slots.appointment_time,
                tzinfo=ZoneInfo(salon.timezone),
            ).astimezone(ZoneInfo("UTC"))

            appointment = Appointment(
                salon_id=salon.id,
                customer_id=customer.id,
                service_id=service.id,
                booking_reference=self._generate_booking_reference(),
                channel=customer.channel,
                status=AppointmentStatus.CONFIRMED,
                language=state.slots.language or salon.default_language,
                marriage_type=state.slots.marriage_type or "Unknown",
                service_name_snapshot=service.name,
                appointment_at=appointment_at,
                booking_payload=state.model_dump(mode="json"),
            )
            self.db.add(appointment)
            await self.db.flush()

            # Schedule notification jobs - if this fails, appointment creation rolls back
            self._schedule_default_notification_jobs(appointment)
            await self.db.flush()
            
            logger.info(f"Created appointment {appointment.booking_reference} for customer {customer.id}")
            return appointment
            
        except Exception as e:
            logger.error(f"Failed to create appointment: {e}")
            await self.db.rollback()
            raise

    async def cancel_appointment(
        self,
        appointment_id: UUID,
        reason: str | None = None,
        cancelled_by: str = "client",
    ) -> Appointment | None:
        appointment = await self.get_appointment(appointment_id)
        if not appointment:
            return None

        if appointment.status in {AppointmentStatus.CANCELLED_BY_CLIENT, AppointmentStatus.CANCELLED_BY_USER}:
            return appointment

        appointment.status = (
            AppointmentStatus.CANCELLED_BY_CLIENT if cancelled_by == "client" else AppointmentStatus.CANCELLED_BY_USER
        )
        appointment.cancelled_at = utc_now()
        appointment.cancellation_reason = reason

        cancellation_job = NotificationJob(
            appointment_id=appointment.id,
            salon_id=appointment.salon_id,
            job_type=NotificationJobType.CUSTOMER_CANCELLATION,
            due_at=utc_now(),
            payload={"reason": reason or "", "cancelled_by": cancelled_by},
        )
        self.db.add(cancellation_job)
        await self.db.flush()
        return appointment

    async def get_appointment(self, appointment_id: UUID) -> Appointment | None:
        statement: Select[tuple[Appointment]] = (
            select(Appointment)
            .options(
                joinedload(Appointment.customer),
                joinedload(Appointment.service),
                joinedload(Appointment.salon),
                joinedload(Appointment.notification_jobs),
            )
            .where(Appointment.id == appointment_id)
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def update_status(self, appointment_id: UUID, new_status: str) -> Appointment | None:
        appointment = await self.get_appointment(appointment_id)
        if not appointment:
            return None
        
        try:
            status_enum = AppointmentStatus(new_status.lower())
        except ValueError:
            raise ValueError(f"Invalid appointment status: {new_status}")

        appointment.status = status_enum
        await self.db.flush()
        return appointment

    async def list_appointments(self, salon_id: UUID | None = None, status: str | None = None) -> list[Appointment]:
        query = select(Appointment).options(joinedload(Appointment.customer), joinedload(Appointment.service))
        if salon_id:
            query = query.where(Appointment.salon_id == salon_id)
        if status:
            try:
                status_enum = AppointmentStatus(status.lower())
                query = query.where(Appointment.status == status_enum)
            except ValueError:
                pass
        
        query = query.order_by(Appointment.appointment_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_upcoming_appointments(self, salon_id, hours: int = 24) -> list[Appointment]:
        now = utc_now()
        until = now + timedelta(hours=hours)
        statement: Select[tuple[Appointment]] = (
            select(Appointment)
            .options(joinedload(Appointment.customer), joinedload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.status == AppointmentStatus.CONFIRMED,
                Appointment.appointment_at >= now,
                Appointment.appointment_at <= until,
            )
            .order_by(Appointment.appointment_at.asc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def _get_service(self, service_id: UUID) -> SalonService | None:
        result = await self.db.execute(select(SalonService).where(SalonService.id == service_id))
        return result.scalar_one_or_none()

    def _schedule_default_notification_jobs(self, appointment: Appointment) -> None:
        now = utc_now()
        job_specs = [
            (60, NotificationJobType.CUSTOMER_REMINDER_60),
            (15, NotificationJobType.CUSTOMER_REMINDER_15),
            (60, NotificationJobType.SALON_DIGEST_60),
            (15, NotificationJobType.SALON_DIGEST_15),
        ]
        for minutes_before, job_type in job_specs:
            due_at = appointment.appointment_at - timedelta(minutes=minutes_before)
            if due_at <= now:
                continue
            self.db.add(
                NotificationJob(
                    appointment_id=appointment.id,
                    salon_id=appointment.salon_id,
                    job_type=job_type,
                    due_at=due_at,
                    payload={"minutes_before": minutes_before},
                )
            )

    @staticmethod
    def _generate_booking_reference() -> str:
        return f"BP-{uuid4().hex[:8].upper()}"
