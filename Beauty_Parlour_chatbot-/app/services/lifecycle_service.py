from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.enums import AppointmentStatus
from app.db.models.appointment import Appointment
from app.db.models.common import utc_now
from app.services.appointment_service import DEFAULT_DURATION_MINUTES
from app.utils.logger import app_logger


# Statuses that must never be touched by the lifecycle worker
_TERMINAL_STATUSES = {
    AppointmentStatus.CANCELLED_BY_CLIENT,
    AppointmentStatus.CANCELLED_BY_USER,
    AppointmentStatus.CANCELLED_BY_SALON,
    AppointmentStatus.CANCELLED_BY_RECEPTION,
    AppointmentStatus.CANCELLED_CLOSURE,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.COMPLETED,
}

# Statuses that the worker may auto-advance
_ADVANCEABLE_STATUSES = {
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.IN_PROGRESS,
}


@dataclass
class LifecycleResult:
    started: int = 0      # confirmed → in_progress
    completed: int = 0    # confirmed/in_progress → completed


class LifecycleService:
    """
    Advances appointment statuses based on wall-clock time.

    Rules
    -----
    * confirmed  → in_progress  when now >= appointment_at
    * confirmed/in_progress → completed  when now >= appointment_at + duration_minutes
    * cancelled_* and no_show are never touched.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def run_once(self) -> LifecycleResult:
        """
        Fetch all appointments that may need a status advance and update them
        in a single transaction.  Returns counts of rows changed.
        """
        now = utc_now()
        result = LifecycleResult()

        # Load every appointment that is not yet in a terminal state and whose
        # appointment_at is in the past (only past appointments can advance).
        stmt = (
            select(Appointment)
            .options(joinedload(Appointment.service))
            .where(
                Appointment.status.in_(list(_ADVANCEABLE_STATUSES)),
                Appointment.appointment_at <= now,
            )
            .with_for_update(skip_locked=True)  # safe for concurrent workers
        )
        rows = await self.db.execute(stmt)
        appointments = rows.unique().scalars().all()

        for appt in appointments:
            duration = (
                appt.service.duration_minutes
                if appt.service and appt.service.duration_minutes
                else DEFAULT_DURATION_MINUTES
            )
            end_time = appt.appointment_at + timedelta(minutes=duration)

            if now >= end_time:
                # Appointment window has passed — mark complete
                appt.status = AppointmentStatus.COMPLETED
                result.completed += 1
                app_logger.info(
                    "Lifecycle: appointment completed",
                    event="lifecycle_completed",
                    appointment_id=str(appt.id),
                    booking_reference=appt.booking_reference,
                    appointment_at=appt.appointment_at.isoformat(),
                    duration_minutes=duration,
                )
            elif appt.status == AppointmentStatus.CONFIRMED:
                # Appointment has started but not yet finished
                appt.status = AppointmentStatus.IN_PROGRESS
                result.started += 1
                app_logger.info(
                    "Lifecycle: appointment in progress",
                    event="lifecycle_in_progress",
                    appointment_id=str(appt.id),
                    booking_reference=appt.booking_reference,
                    appointment_at=appt.appointment_at.isoformat(),
                    duration_minutes=duration,
                )
            # If already in_progress but end_time is still in future, no change needed

        if result.started or result.completed:
            await self.db.flush()

        return result
