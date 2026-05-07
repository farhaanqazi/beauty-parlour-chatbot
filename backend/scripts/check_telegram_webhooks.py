"""Print the URL Telegram has registered for each Telegram-enabled salon.

Read-only diagnostic. Useful when bots stop replying and you want to know
whether Telegram is pointing at the right base URL.

    cd backend && python scripts/check_telegram_webhooks.py
"""
from __future__ import annotations

import asyncio

import httpx
from sqlalchemy import select

from app.core.enums import ChannelType
from app.db.models.salon import Salon, SalonChannel
from app.db.session import db_session


async def main() -> None:
    async with db_session.session_factory() as db:
        rows = (
            await db.execute(
                select(Salon, SalonChannel)
                .join(SalonChannel, SalonChannel.salon_id == Salon.id)
                .where(SalonChannel.channel == ChannelType.TELEGRAM)
            )
        ).all()
        async with httpx.AsyncClient(timeout=10) as client:
            for salon, channel in rows:
                bot_token = (channel.provider_config or {}).get("bot_token") or ""
                if not bot_token:
                    print(f"{salon.slug}: NO TOKEN")
                    continue
                response = await client.get(
                    f"https://api.telegram.org/bot{bot_token}/getWebhookInfo"
                )
                info = response.json().get("result", {})
                print(f"{salon.slug}: url={info.get('url')!r} pending={info.get('pending_update_count')} last_error={info.get('last_error_message')}")


if __name__ == "__main__":
    asyncio.run(main())
