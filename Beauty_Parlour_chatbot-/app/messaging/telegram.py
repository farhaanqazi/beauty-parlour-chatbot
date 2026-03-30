from __future__ import annotations

import asyncio
import logging
from typing import List

import httpx

from app.core.config import Settings
from app.db.models.salon import SalonChannel
from app.messaging.base import DeliveryResult, MessagingTransport
from app.schemas.messages import OutboundInstruction


logger = logging.getLogger(__name__)


class TelegramTransport(MessagingTransport):
    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.http_client = http_client

    async def send_instruction(
        self,
        channel_config: SalonChannel,
        destination: str,
        instruction: OutboundInstruction,
    ) -> List[DeliveryResult]:
        """
        Send instruction via Telegram.
        
        Handles errors gracefully - logs failures and returns partial results
        instead of crashing the entire webhook handler.
        """
        token = channel_config.provider_config.get("bot_token") or self.settings.telegram_bot_token
        if not token:
            logger.warning("Telegram bot token not configured")
            return []

        deliveries: List[DeliveryResult] = []
        
        # Send text message
        if instruction.text:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = {"chat_id": destination, "text": instruction.text}
            try:
                response = await self.http_client.post(url, json=payload, timeout=10.0)
                response.raise_for_status()
                data = response.json()
                deliveries.append(
                    DeliveryResult(
                        provider_message_id=str(data.get("result", {}).get("message_id")),
                        text=instruction.text,
                        payload=payload,
                    )
                )
            except httpx.HTTPStatusError as e:
                logger.error(f"Telegram API error (status {e.response.status_code}): {e.response.text[:200]}")
            except httpx.TimeoutException as e:
                logger.error(f"Telegram API timeout: {e}")
            except Exception as e:
                logger.error(f"Unexpected error sending Telegram message: {e}")

        # Send media (photos) - use gather for parallel sends
        if instruction.media_urls:
            send_tasks = []
            for media_url in instruction.media_urls:
                send_tasks.append(self._send_photo(token, destination, media_url))
            
            # Send photos in parallel
            results = await asyncio.gather(*send_tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, DeliveryResult):
                    deliveries.append(result)
                elif isinstance(result, Exception):
                    logger.error(f"Failed to send photo: {result}")
        
        return deliveries

    async def _send_photo(
        self,
        token: str,
        destination: str,
        media_url: str,
    ) -> DeliveryResult | None:
        """Send a single photo, with error handling."""
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        payload = {"chat_id": destination, "photo": media_url}
        try:
            response = await self.http_client.post(url, json=payload, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            return DeliveryResult(
                provider_message_id=str(data.get("result", {}).get("message_id")),
                text=f"[photo] {media_url}",
                payload=payload,
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Telegram photo error (status {e.response.status_code}): {e.response.text[:200]}")
        except httpx.TimeoutException as e:
            logger.error(f"Telegram photo timeout: {e}")
        except Exception as e:
            logger.error(f"Unexpected error sending photo: {e}")
        return None
