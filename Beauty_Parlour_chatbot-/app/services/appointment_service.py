from __future__ import annotations
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
from app.utils.logger import app_logger


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

        Uses a nested transaction (savepoint) to isolate validation failures.
        If any step fails, only the inner transaction rolls back — the outer
        session stays clean so the caller can continue gracefully.
        """
        if not state.slots.service_id or not state.slots.appointment_date or not state.slots.appointment_time:
            raise ValueError("Conversation state is missing appointment details.")

        with app_logger.track_operation(
            "create_appointment",
            salon_id=str(salon.id),
            customer_id=str(customer.id),
        ):
            async with self.db.begin_nested():
                service = await self._get_service(UUID(state.slots.service_id))
                if not service:
                    raise ValueError("Selected service does not exist.")

                if service.salon_id != salon.id:
                    app_logger.error(
                        "Service-salon mismatch detected",
                        event="security_alert",
                        alert_type="service_salon_mismatch",
                        salon_id=str(salon.id),
                        service_id=str(service.id),
                        service_salon_id=str(service.salon_id),
                        customer_id=str(customer.id),
                    )
                    raise ValueError("Selected service does not belong to salon.")

                appointment_at = datetime.combine(
                    state.slots.appointment_date,
                    state.slots.appointment_time,
                    tzinfo=ZoneInfo(salon.timezone),
                ).astimezone(ZoneInfo("UTC"))

                # --- Maximum advance booking validation (3 months) ---
                max_booking_date = utc_now() + timedelta(days=90)
                if appointment_at > max_booking_date:
                    app_logger.warn(
                        "Booking date exceeds maximum advance booking limit",
                        event="booking_date_too_far",
                        salon_id=str(salon.id),
                        requested_date=appointment_at.isoformat(),
                        max_allowed_date=max_booking_date.isoformat(),
                    )
                    raise ValueError("Appointments can only be booked up to 3 months in advance.")

                # --- Business hours validation ---
                self._validate_business_hours(appointment_at, salon)

                # --- Availability / conflict checking ---
                overlap = await self._check_availability(salon.id, appointment_at, service)
                if overlap:
                    app_logger.warn(
                        "Time slot unavailable",
                        event="booking_conflict",
                        salon_id=str(salon.id),
                        appointment_at=appointment_at.isoformat(),
                        service_id=str(service.id),
                        overlapping_booking=str(overlap.id),
                    )
                    raise ValueError(
                        f"Slot {state.slots.appointment_time} on {state.slots.appointment_date} is already booked. "
                        "Please choose a different time."
                    )

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

                app_logger.info(
                    "Appointment created",
                    event="appointment_created",
                    booking_reference=appointment.booking_reference,
                    customer_id=str(customer.id),
                    salon_id=str(salon.id),
                    service_id=str(service.id),
                )
                return appointment

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
        # Get salon to find its timezone
        salon_stmt = select(Salon).where(Salon.id == salon_id)
        salon_result = await self.db.execute(salon_stmt)
        salon = salon_result.scalar_one_or_none()
        
        if not salon:
            return []
        
        # Use salon's timezone for "today" calculation
        salon_tz = ZoneInfo(salon.timezone or "UTC")
        now_salon_time = utc_now().astimezone(salon_tz)
        
        # Start of today in salon timezone
        today_start = now_salon_time.replace(hour=0, minute=0, second=0, microsecond=0)
        # End of tomorrow (to show "upcoming" appointments)
        until = today_start + timedelta(days=2)
        
        # Convert back to UTC for database comparison
        today_start_utc = today_start.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
        until_utc = until.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
        
        statement: Select[tuple[Appointment]] = (
            select(Appointment)
            .options(joinedload(Appointment.customer), joinedload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.appointment_at >= today_start_utc,
                Appointment.appointment_at <= until_utc,
            )
            .order_by(Appointment.appointment_at.asc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def _get_service(self, service_id: UUID) -> SalonService | None:
        result = await self.db.execute(select(SalonService).where(SalonService.id == service_id))
        return result.scalar_one_or_none()

    def _validate_business_hours(self, appointment_at: datetime, salon: Salon) -> None:
        """
        Validate the appointment falls within the salon's operating hours.
        
        Salon operating hours are stored in the flow_config JSONB column as:
        {"opening_hour": 9, "closing_hour": 18, "closed_days": ["sunday"]}
        Defaults to 9:00-18:00 if not configured.
        """
        flow_config = getattr(salon, "flow_config", {}) or {}
        opening_hour = flow_config.get("opening_hour", 9)
        closing_hour = flow_config.get("closing_hour", 18)
        closed_days = [d.lower() for d in flow_config.get("closed_days", [])]

        # Convert to salon local time for business hours check
        local_time = appointment_at.astimezone(ZoneInfo(salon.timezone))
        day_name = local_time.strftime("%A").lower()

        if day_name in closed_days:
            raise ValueError(
                f"The salon is closed on {day_name.capitalize()}. Please choose another day."
            )

        if local_time.hour < opening_hour or local_time.hour >= closing_hour:
            raise ValueError(
                f"The salon is open from {opening_hour:02d}:00 to {closing_hour:02d}:00. "
                f"{local_time.strftime('%H:%M')} is outside business hours."
            )

    async def _check_availability(
        self, salon_id: UUID, appointment_at: datetime, service: SalonService
    ) -> Appointment | None:
        """
        Check if the requested time slot conflicts with an existing confirmed appointment.

        Uses proper overlap detection: existing.start < new.end AND existing.end > new.start
        Includes a 15-minute buffer between appointments.
        Returns the conflicting appointment if one exists, None otherwise.
        """
        buffer_minutes = 15
        new_duration = timedelta(minutes=max(service.duration_minutes, 0))
        new_start = appointment_at
        new_end = appointment_at + new_duration

        # Calculate buffer windows
        buffer_start = new_start - timedelta(minutes=buffer_minutes)
        buffer_end = new_end + timedelta(minutes=buffer_minutes)

        # Find existing appointments that could overlap (broad window)
        statement = (
            select(Appointment)
            .options(joinedload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.status.in_([AppointmentStatus.CONFIRMED]),
                Appointment.appointment_at >= buffer_start,
                Appointment.appointment_at <= buffer_end,
            )
        )
        result = await self.db.execute(statement)
        existing_appointments = result.scalars().unique().all()

        # Check for actual overlaps including duration
        for existing in existing_appointments:
            existing_start = existing.appointment_at
            # Get existing duration from service
            existing_duration = timedelta(minutes=60)  # Default fallback
            if existing.service:
                existing_duration = timedelta(minutes=max(existing.service.duration_minutes, 0))
            existing_end = existing_start + existing_duration

            # Proper overlap check: existing.start < new.end AND existing.end > new.start
            if existing_start < new_end and existing_end > new_start:
                return existing

        return None

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
