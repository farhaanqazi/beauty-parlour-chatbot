"""One-off: print what get_booked_hours_for_date returns for a known date."""
from __future__ import annotations

import asyncio
from datetime import date
from uuid import UUID

from app.db.session import db_session
from app.services.appointment_service import AppointmentService


SALON_ID = UUID("0c5bda6b-9b9f-400d-8391-3d5b22720f06")
TARGET_DATE = date(2026, 5, 13)
TZ = "Asia/Kolkata"


async def main() -> None:
    async with db_session.session_factory() as db:
        svc = AppointmentService(db)
        for duration in (60, 90, 120):
            booked = await svc.get_booked_hours_for_date(
                salon_id=SALON_ID,
                target_date=TARGET_DATE,
                timezone_name=TZ,
                new_service_duration_minutes=duration,
            )
            print(f"duration={duration}min  booked_hours={sorted(booked)}")


if __name__ == "__main__":
    asyncio.run(main())
