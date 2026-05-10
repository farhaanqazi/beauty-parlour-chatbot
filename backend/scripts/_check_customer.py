"""One-off: dump the Customer row for the Telegram user we've been testing with."""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db.models.customer import Customer
from app.db.session import db_session


async def main() -> None:
    async with db_session.session_factory() as db:
        result = await db.execute(
            select(Customer).where(Customer.display_name.ilike("%farhaan%")).limit(5)
        )
        rows = result.scalars().all()
        if not rows:
            print("No customer matched 'farhaan' display_name.")
            return
        for c in rows:
            print(f"id={c.id}  salon={c.salon_id}")
            print(f"  display_name={c.display_name!r}")
            print(f"  phone={c.phone_number!r}")
            print(f"  email={c.email!r}")
            print(f"  external_user_id={getattr(c, 'external_user_id', None)!r}")
            print(f"  created={c.created_at}  updated={c.updated_at}")
            print()


if __name__ == "__main__":
    asyncio.run(main())
