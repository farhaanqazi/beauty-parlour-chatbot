"""One-off: print durations for the test salon's services."""
from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy import select

from app.db.models.salon import SalonService
from app.db.session import db_session


SALON_ID = UUID("0c5bda6b-9b9f-400d-8391-3d5b22720f06")


async def main() -> None:
    async with db_session.session_factory() as db:
        rows = (
            await db.execute(
                select(SalonService).where(SalonService.salon_id == SALON_ID).order_by(SalonService.name)
            )
        ).scalars().all()
        for s in rows:
            print(f"{s.name:30s}  duration={s.duration_minutes}min  price={s.price or 0}  active={s.is_active}")


if __name__ == "__main__":
    asyncio.run(main())
