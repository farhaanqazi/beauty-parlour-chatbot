"""Idempotent Telegram webhook registration.

On app startup, ensures every salon's Telegram bot is registered against the
current public base URL. If Telegram already has the right URL + secret, the
bot is skipped (no API call). This makes ngrok URL changes a one-step fix:
update WEBHOOK_BASE_URL in .env and restart.
"""
from __future__ import annotations

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ChannelType
from app.db.models.salon import Salon, SalonChannel
from app.utils.logger import app_logger


async def register_telegram_webhooks(
    db: AsyncSession,
    http_client: httpx.AsyncClient,
    base_url: str,
    api_prefix: str,
) -> None:
    base_url = base_url.rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        app_logger.warn(
            "Skipping Telegram webhook auto-registration: WEBHOOK_BASE_URL is not a full http(s) URL",
            event="telegram_webhook_skip",
            base_url=base_url,
        )
        return

    rows = (
        await db.execute(
            select(Salon, SalonChannel)
            .join(SalonChannel, SalonChannel.salon_id == Salon.id)
            .where(SalonChannel.channel == ChannelType.TELEGRAM)
        )
    ).all()

    for salon, channel in rows:
        bot_token = (channel.provider_config or {}).get("bot_token")
        if not bot_token:
            continue

        desired_url = f"{base_url}{api_prefix}/webhooks/telegram/{salon.slug}"
        desired_secret = bot_token.replace(":", "_")

        try:
            info_response = await http_client.get(
                f"https://api.telegram.org/bot{bot_token}/getWebhookInfo",
                timeout=10.0,
            )
            info = info_response.json().get("result", {}) if info_response.status_code == 200 else {}

            if info.get("url") == desired_url:
                app_logger.info(
                    "Telegram webhook already up-to-date",
                    event="telegram_webhook_unchanged",
                    salon_slug=salon.slug,
                )
                continue

            set_response = await http_client.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={
                    "url": desired_url,
                    "secret_token": desired_secret,
                    "drop_pending_updates": True,
                },
                timeout=10.0,
            )
            ok = set_response.status_code == 200 and set_response.json().get("ok") is True
            if ok:
                app_logger.info(
                    "Telegram webhook registered",
                    event="telegram_webhook_registered",
                    salon_slug=salon.slug,
                    previous_url=info.get("url") or None,
                )
            else:
                app_logger.error(
                    "Telegram setWebhook failed",
                    event="telegram_webhook_register_failed",
                    salon_slug=salon.slug,
                    status_code=set_response.status_code,
                    response_body=set_response.text[:300],
                )
        except Exception as exc:  # noqa: BLE001 — startup must not crash on a single bad bot
            app_logger.error(
                "Telegram webhook registration error",
                event="telegram_webhook_register_error",
                salon_slug=salon.slug,
                error_type=type(exc).__name__,
                error_message=str(exc),
            )
