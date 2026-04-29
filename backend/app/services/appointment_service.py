from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.enums import AppointmentStatus, NotificationJobStatus, NotificationJobType
from app.db.models.appointment import Appointment, NotificationJob
from app.db.models.customer import Customer
from app.db.models.salon import Salon, SalonService
from app.db.models.common import utc_now
from app.schemas.state import ConversationState
from app.services.email_service import EmailService
from app.utils.logger import app_logger

if TYPE_CHECKING:
    pass


# Default service duration (minutes) when the associated service record is missing
DEFAULT_DURATION_MINUTES = 60


class AppointmentService:
    def __init__(self, db: AsyncSession, email_service: EmailService | None = None) -> None:
        self.db = db
        self.email_service = email_service

    # ------------------------------------------------------------------
    # CREATE
    # ------------------------------------------------------------------

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

                # --- Availability / conflict checking with row-level lock ---
                overlap = await self._check_availability_locked(salon.id, appointment_at, service)
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
                        "This time slot is already booked. Please choose another."
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
                    final_price=service.price,
                    booking_payload=state.model_dump(mode="json"),
                )
                self.db.add(appointment)
                await self.db.flush()

                # Schedule notification jobs — if this fails, appointment creation rolls back
                await self._schedule_default_notification_jobs(appointment)

                app_logger.info(
                    "Appointment created",
                    event="appointment_created",
                    booking_reference=appointment.booking_reference,
                    customer_id=str(customer.id),
                    salon_id=str(salon.id),
                    service_id=str(service.id),
                )

                # Send emails if email service is configured (non-blocking for appointment creation)
                await self._send_booking_emails_safe(appointment, salon, state)

                return appointment

    # ------------------------------------------------------------------
    # CANCEL
    # ------------------------------------------------------------------

    async def cancel_appointment(
        self,
        appointment_id: UUID,
        salon_id: UUID,
        reason: str | None = None,
        cancelled_by: str = "client",
    ) -> Appointment | None:
        """
        Cancel an appointment with salon ownership check.

        Args:
            appointment_id: The appointment to cancel.
            salon_id: The salon that owns this appointment (authorization guard).
            reason: Optional cancellation reason.
            cancelled_by: Who cancelled — "client", "salon", or "reception".

        Returns:
            The cancelled Appointment, or None if not found.
        """
        async with self.db.begin_nested():
            appointment = await self.get_appointment(appointment_id)
            if not appointment:
                return None

            # Authorization: prevent cross-salon cancellation
            if appointment.salon_id != salon_id:
                app_logger.warn(
                    "Cross-salon cancellation attempt blocked",
                    event="security_alert",
                    alert_type="unauthorized_cancellation",
                    appointment_id=str(appointment_id),
                    appointment_salon_id=str(appointment.salon_id),
                    requesting_salon_id=str(salon_id),
                )
                raise ValueError("Appointment does not belong to this salon.")

            if appointment.status in {
                AppointmentStatus.CANCELLED_BY_CLIENT,
                AppointmentStatus.CANCELLED_BY_USER,
            }:
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

            app_logger.info(
                "Appointment cancelled",
                event="appointment_cancelled",
                booking_reference=appointment.booking_reference,
                appointment_id=str(appointment_id),
                cancelled_by=cancelled_by,
            )

            return appointment

    # ------------------------------------------------------------------
    # READ
    # ------------------------------------------------------------------

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
        return result.unique().scalar_one_or_none()

    async def list_appointments(
        self,
        salon_id: UUID | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Appointment]:
        """
        List appointments with pagination to prevent OOM on large datasets.

        Args:
            limit: Max number of records to return (default 100).
            offset: Number of records to skip.
        """
        query = select(Appointment).options(
            joinedload(Appointment.customer),
            joinedload(Appointment.service),
        )
        if salon_id:
            query = query.where(Appointment.salon_id == salon_id)
        if status:
            try:
                status_enum = AppointmentStatus(status.lower())
                query = query.where(Appointment.status == status_enum)
            except ValueError:
                pass

        query = query.order_by(Appointment.appointment_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def list_upcoming_appointments(self, salon_id: UUID, hours: int = 24) -> list[Appointment]:
        """Return appointments from today through tomorrow for a given salon."""
        salon_stmt = select(Salon).where(Salon.id == salon_id)
        salon_result = await self.db.execute(salon_stmt)
        salon = salon_result.scalar_one_or_none()

        if not salon:
            return []

        salon_tz = ZoneInfo(salon.timezone or "UTC")
        now_salon_time = utc_now().astimezone(salon_tz)
        today_start = now_salon_time.replace(hour=0, minute=0, second=0, microsecond=0)
        until = today_start + timedelta(days=2)

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

    async def lookup_active_appointments(
        self,
        customer: Customer,
        salon: Salon,
    ) -> list[Appointment]:
        """
        Look up a customer's upcoming (non-cancelled, non-completed) appointments
        at a specific salon. Deterministic SQL — no LLM involved.

        Returns appointments sorted by date (soonest first), limited to the next 90 days.
        """
        now_utc = utc_now()
        cutoff = now_utc + timedelta(days=90)

        statement: Select[tuple[Appointment]] = (
            select(Appointment)
            .options(joinedload(Appointment.service))
            .where(
                Appointment.customer_id == customer.id,
                Appointment.salon_id == salon.id,
                Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
                Appointment.appointment_at >= now_utc,
                Appointment.appointment_at <= cutoff,
            )
            .order_by(Appointment.appointment_at.asc())
        )
        result = await self.db.execute(statement)
        appointments = list(result.scalars().unique().all())

        app_logger.info(
            "Appointment lookup performed",
            event="appointment_lookup",
            customer_id=str(customer.id),
            salon_id=str(salon.id),
            found_count=len(appointments),
        )

        return appointments

    # ------------------------------------------------------------------
    # RESCHEDULE
    # ------------------------------------------------------------------

    async def update_appointment_time(
        self,
        appointment: Appointment,
        salon: Salon,
        new_date: date,
        new_time: time,
    ) -> Appointment:
        """
        Reschedule an existing appointment to a new date/time.

        Validates availability and business hours before updating.
        Cancels old notification jobs and schedules new ones within a single
        nested transaction so the operation is atomic.

        Returns the updated appointment.
        """
        if not appointment.service:
            raise ValueError("Appointment has no associated service.")

        # Validate the new time is in the future
        new_appointment_at = datetime.combine(
            new_date,
            new_time,
            tzinfo=ZoneInfo(salon.timezone),
        ).astimezone(ZoneInfo("UTC"))

        if new_appointment_at <= utc_now():
            raise ValueError("The new appointment time must be in the future.")

        # --- Maximum advance booking validation (3 months) ---
        max_booking_date = utc_now() + timedelta(days=90)
        if new_appointment_at > max_booking_date:
            raise ValueError("Appointments can only be booked up to 3 months in advance.")

        # --- Business hours validation ---
        self._validate_business_hours(new_appointment_at, salon)

        with app_logger.track_operation(
            "reschedule_appointment",
            appointment_id=str(appointment.id),
            booking_reference=appointment.booking_reference,
        ):
            async with self.db.begin_nested():
                # --- Availability check (exclude this appointment's own slot) with lock ---
                overlap = await self._check_availability_locked_excluding(
                    salon.id,
                    new_appointment_at,
                    appointment.service,
                    exclude_id=appointment.id,
                )
                if overlap:
                    app_logger.warn(
                        "Reschedule conflict",
                        event="reschedule_conflict",
                        booking_reference=appointment.booking_reference,
                        conflicting_booking=str(overlap.id),
                    )
                    raise ValueError("This time slot is already booked. Please choose another.")

                # Apply the update
                appointment.appointment_at = new_appointment_at

                # Swap notification jobs atomically
                await self._cancel_notification_jobs(appointment.id)
                await self._schedule_default_notification_jobs(appointment)

            app_logger.info(
                "Appointment rescheduled",
                event="appointment_rescheduled",
                booking_reference=appointment.booking_reference,
                customer_id=str(appointment.customer_id),
                new_appointment_at=new_appointment_at.isoformat(),
            )

            return appointment

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

    # ------------------------------------------------------------------
    # NOTIFICATION JOBS
    # ------------------------------------------------------------------

    async def _cancel_notification_jobs(self, appointment_id: UUID) -> None:
        """Delete ALL notification jobs for an appointment (any status).

        Removes SENT jobs too so that rescheduling can insert fresh jobs
        without hitting the unique (appointment_id, job_type) constraint.
        """
        statement = select(NotificationJob).where(
            NotificationJob.appointment_id == appointment_id,
        )
        result = await self.db.execute(statement)
        jobs = result.scalars().all()
        for job in jobs:
            await self.db.delete(job)
        # Flush DELETEs immediately so the unique constraint (appointment_id, job_type)
        # is cleared before _schedule_default_notification_jobs inserts new rows.
        # PostgreSQL enforces non-deferrable constraints per-statement, so without
        # this flush the DELETE and INSERT land in the same batch and conflict.
        await self.db.flush()

    async def _schedule_default_notification_jobs(self, appointment: Appointment) -> None:
        """
        Schedule default notification jobs for an appointment.

        Jobs scheduled per booking:
          - REMINDER_7AM   : 07:00 salon local time on appointment day (morning-of reminder)
          - CUSTOMER_REMINDER_60 : 60 min before appointment
          - CUSTOMER_REMINDER_15 : 15 min before appointment
          - SALON_DIGEST_60      : 60 min before (salon digest)
          - SALON_DIGEST_15      : 15 min before (salon digest)

        All jobs are skipped silently if their due_at is already in the past
        at the time of booking — matching industry-standard "schedule-ahead"
        behaviour (Sidekiq, Celery Beat, BullMQ all do the same).
        """
        now = utc_now()

        # ── 1. 7 AM morning-of reminder ────────────────────────────────
        # Derive the salon's local timezone from the appointment.
        # Appointment.salon may not be loaded here, so we fetch it lazily
        # via the salon_id FK. We inline a simple select to keep this
        # self-contained and avoid circular loading.
        from zoneinfo import ZoneInfo as _ZI
        from app.db.models.salon import Salon as _Salon
        salon_stmt = select(_Salon).where(_Salon.id == appointment.salon_id)
        salon_result = await self.db.execute(salon_stmt)
        salon_obj = salon_result.scalar_one_or_none()
        salon_tz = _ZI(salon_obj.timezone if salon_obj and salon_obj.timezone else "Asia/Kolkata")

        # Convert appointment time to local tz, then pin to 07:00:00 that day
        appt_local = appointment.appointment_at.astimezone(salon_tz)
        reminder_7am_local = appt_local.replace(hour=7, minute=0, second=0, microsecond=0)
        reminder_7am_utc = reminder_7am_local.astimezone(ZoneInfo("UTC"))

        if reminder_7am_utc > now:
            self.db.add(NotificationJob(
                appointment_id=appointment.id,
                salon_id=appointment.salon_id,
                job_type=NotificationJobType.REMINDER_7AM,
                due_at=reminder_7am_utc,
                payload={"reminder_type": "morning_of"},
            ))

        # ── 2. Standard pre-appointment reminders ──────────────────────
        job_specs: list[tuple[int, NotificationJobType]] = [
            (60, NotificationJobType.CUSTOMER_REMINDER_60),
            (15, NotificationJobType.CUSTOMER_REMINDER_15),
            (60, NotificationJobType.SALON_DIGEST_60),
            (15, NotificationJobType.SALON_DIGEST_15),
        ]
        for minutes_before, job_type in job_specs:
            due_at = appointment.appointment_at - timedelta(minutes=minutes_before)
            if due_at <= now:
                continue

            job = NotificationJob(
                appointment_id=appointment.id,
                salon_id=appointment.salon_id,
                job_type=job_type,
                due_at=due_at,
                payload={"minutes_before": minutes_before},
            )
            self.db.add(job)

        await self.db.flush()

    # ------------------------------------------------------------------
    # AVAILABILITY CHECKS (with row-level locking to prevent race conditions)
    # ------------------------------------------------------------------

    async def _check_availability_locked(
        self,
        salon_id: UUID,
        appointment_at: datetime,
        service: SalonService,
    ) -> Appointment | None:
        """
        Check slot availability with a SELECT FOR UPDATE lock to prevent
        concurrent double-bookings (TOCTOU race condition).

        Returns the conflicting appointment if one exists, None otherwise.
        """
        buffer_minutes = 15
        new_duration = timedelta(minutes=max(service.duration_minutes, 0) if service.duration_minutes else DEFAULT_DURATION_MINUTES)
        new_start = appointment_at
        new_end = appointment_at + new_duration

        buffer_start = new_start - timedelta(minutes=buffer_minutes)
        buffer_end = new_end + timedelta(minutes=buffer_minutes)

        statement = (
            select(Appointment)
            .options(selectinload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.status.in_([AppointmentStatus.CONFIRMED]),
                Appointment.appointment_at >= buffer_start,
                Appointment.appointment_at <= buffer_end,
            )
            .with_for_update()  # Block concurrent transactions — skip_locked would silently miss locked rows and allow double-bookings
        )
        result = await self.db.execute(statement)
        existing_appointments = result.scalars().unique().all()

        for existing in existing_appointments:
            existing_start = existing.appointment_at
            existing_duration = timedelta(
                minutes=max(existing.service.duration_minutes, 0)
                if existing.service and existing.service.duration_minutes
                else DEFAULT_DURATION_MINUTES
            )
            existing_end = existing_start + existing_duration

            if existing_start < new_end and existing_end > new_start:
                return existing

        return None

    async def _check_availability_locked_excluding(
        self,
        salon_id: UUID,
        appointment_at: datetime,
        service: SalonService,
        exclude_id: UUID,
    ) -> Appointment | None:
        """
        Same as _check_availability_locked but excludes a specific appointment ID.

        Used when rescheduling — prevents flagging the user's own slot as a conflict.
        """
        buffer_minutes = 15
        new_duration = timedelta(minutes=max(service.duration_minutes, 0) if service.duration_minutes else DEFAULT_DURATION_MINUTES)
        new_start = appointment_at
        new_end = appointment_at + new_duration

        buffer_start = new_start - timedelta(minutes=buffer_minutes)
        buffer_end = new_end + timedelta(minutes=buffer_minutes)

        statement = (
            select(Appointment)
            .options(selectinload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.status.in_([AppointmentStatus.CONFIRMED]),
                Appointment.appointment_at >= buffer_start,
                Appointment.appointment_at <= buffer_end,
                Appointment.id != exclude_id,
            )
            .with_for_update()  # Block concurrent transactions — skip_locked would silently miss locked rows and allow double-bookings
        )
        result = await self.db.execute(statement)
        existing_appointments = result.scalars().unique().all()

        for existing in existing_appointments:
            existing_start = existing.appointment_at
            existing_duration = timedelta(
                minutes=max(existing.service.duration_minutes, 0)
                if existing.service and existing.service.duration_minutes
                else DEFAULT_DURATION_MINUTES
            )
            existing_end = existing_start + existing_duration

            if existing_start < new_end and existing_end > new_start:
                return existing

        return None

    # ------------------------------------------------------------------
    # AVAILABILITY — READ-ONLY QUERIES FOR BOOKING DISPLAY
    # ------------------------------------------------------------------

    async def get_booked_hours_for_date(
        self,
        salon_id: UUID,
        target_date: date,
        timezone_name: str,
        start_hour: int = 9,
        end_hour: int = 18,
    ) -> set[int]:
        """
        Return the set of hours (salon local time) within [start_hour, end_hour)
        that are unavailable on target_date due to confirmed or pending appointments.

        An hour H is considered booked when any appointment's window
        [appt_start, appt_start + duration + 15 min buffer) overlaps [H:00, H+1:00).
        """
        tz = ZoneInfo(timezone_name)
        day_start_utc = datetime(
            target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=tz
        ).astimezone(ZoneInfo("UTC"))
        day_end_utc = datetime(
            target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=tz
        ).astimezone(ZoneInfo("UTC"))

        stmt = (
            select(Appointment)
            .options(selectinload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
                Appointment.appointment_at >= day_start_utc,
                Appointment.appointment_at <= day_end_utc,
            )
        )
        result = await self.db.execute(stmt)
        appointments = result.scalars().unique().all()

        booked: set[int] = set()
        for appt in appointments:
            appt_local = appt.appointment_at.astimezone(tz)
            dur = DEFAULT_DURATION_MINUTES
            if appt.service and appt.service.duration_minutes:
                dur = appt.service.duration_minutes
            appt_end = appt_local + timedelta(minutes=dur + 15)

            end_total_min = appt_end.hour * 60 + appt_end.minute
            last_hour = (end_total_min - 1) // 60 if end_total_min > 0 else appt_local.hour

            for h in range(appt_local.hour, min(last_hour + 1, 24)):
                if start_hour <= h < end_hour:
                    booked.add(h)

        return booked

    async def get_fully_booked_dates(
        self,
        salon_id: UUID,
        from_date: date,
        num_days: int,
        timezone_name: str,
        start_hour: int = 9,
        end_hour: int = 18,
    ) -> set[date]:
        """
        Return which dates in [from_date, from_date + num_days) have every
        bookable hour [start_hour, end_hour) covered by existing appointments.

        Uses a single query for the whole range to minimise round-trips.
        """
        if num_days <= 0:
            return set()

        tz = ZoneInfo(timezone_name)
        check_dates = [from_date + timedelta(days=i) for i in range(num_days)]
        max_date = check_dates[-1]

        range_start_utc = datetime(
            from_date.year, from_date.month, from_date.day, 0, 0, 0, tzinfo=tz
        ).astimezone(ZoneInfo("UTC"))
        range_end_utc = datetime(
            max_date.year, max_date.month, max_date.day, 23, 59, 59, tzinfo=tz
        ).astimezone(ZoneInfo("UTC"))

        stmt = (
            select(Appointment)
            .options(selectinload(Appointment.service))
            .where(
                Appointment.salon_id == salon_id,
                Appointment.status.in_([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
                Appointment.appointment_at >= range_start_utc,
                Appointment.appointment_at <= range_end_utc,
            )
        )
        result = await self.db.execute(stmt)
        appointments = result.scalars().unique().all()

        date_booked_hours: dict[date, set[int]] = {d: set() for d in check_dates}

        for appt in appointments:
            appt_local = appt.appointment_at.astimezone(tz)
            appt_date = appt_local.date()
            if appt_date not in date_booked_hours:
                continue

            dur = DEFAULT_DURATION_MINUTES
            if appt.service and appt.service.duration_minutes:
                dur = appt.service.duration_minutes
            appt_end = appt_local + timedelta(minutes=dur + 15)

            end_total_min = appt_end.hour * 60 + appt_end.minute
            last_hour = (end_total_min - 1) // 60 if end_total_min > 0 else appt_local.hour

            for h in range(appt_local.hour, min(last_hour + 1, 24)):
                if start_hour <= h < end_hour:
                    date_booked_hours[appt_date].add(h)

        all_hours = set(range(start_hour, end_hour))
        return {d for d, booked in date_booked_hours.items() if all_hours.issubset(booked)}

    # ------------------------------------------------------------------
    # INTERNAL HELPERS
    # ------------------------------------------------------------------

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

    @staticmethod
    def _generate_booking_reference() -> str:
        return f"BP-{uuid4().hex[:8].upper()}"

    async def _send_booking_emails_safe(
        self,
        appointment: Appointment,
        salon: Salon,
        state: ConversationState,
    ) -> None:
        """
        Send confirmation emails — wrapped in try/except so email failures
        never prevent the appointment from being created.
        """
        if not self.email_service or not state.slots.email:
            return
        if not state.slots.appointment_date or not state.slots.appointment_time:
            return

        try:
            date_str = state.slots.appointment_date.strftime("%d %b %Y")
            time_str = state.slots.appointment_time.strftime("%I:%M %p")

            await self.email_service.send_appointment_confirmation(
                to_email=state.slots.email,
                customer_name=state.slots.customer_name or "Valued Customer",
                salon_name=salon.name,
                service_name=state.slots.service_name or appointment.service_name_snapshot,
                appointment_date=date_str,
                appointment_time=time_str,
                booking_reference=appointment.booking_reference,
            )

            owner_email = self.email_service.settings.salon_owner_email
            if owner_email:
                await self.email_service.send_owner_notification(
                    owner_email=owner_email,
                    salon_name=salon.name,
                    customer_email=state.slots.email,
                    service_name=state.slots.service_name or appointment.service_name_snapshot,
                    appointment_date=date_str,
                    appointment_time=time_str,
                    booking_reference=appointment.booking_reference,
                )
        except Exception as e:
            app_logger.warn(
                "Email send failed (non-fatal)",
                event="email_send_error",
                booking_reference=appointment.booking_reference,
                error=str(e),
            )
