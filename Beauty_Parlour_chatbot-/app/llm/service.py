from __future__ import annotations

import json
from datetime import date
from typing import Any

from groq import AsyncGroq

from app.core.config import Settings


class LLMService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: AsyncGroq | None = None
        if settings.llm_api_key:
            self.client = AsyncGroq(
                api_key=settings.llm_api_key,
                base_url=settings.llm_base_url,
            )

    async def classify_option(
        self,
        message: str,
        options: list[dict[str, Any]],
        field_name: str,
        language: str | None = None,
    ) -> str | None:
        if not self.client:
            return None

        payload = await self._json_completion(
            system_prompt=(
                "You classify a user reply into one option id. "
                "Return JSON only with keys match_id and confidence."
            ),
            user_prompt=(
                f"Field: {field_name}\n"
                f"User language: {language or 'unknown'}\n"
                f"User message: {message}\n"
                f"Options: {json.dumps(options)}\n"
                "If no option matches, return match_id as null."
            ),
        )
        if not isinstance(payload, dict):
            return None
        match_id = payload.get("match_id")
        return str(match_id) if match_id else None

    async def parse_date(
        self,
        message: str,
        timezone_name: str,
        reference_date: date,
        language: str | None = None,
    ) -> str | None:
        if not self.client:
            return None

        payload = await self._json_completion(
            system_prompt=(
                "Extract one appointment date. Return JSON only with keys iso_date and confidence. "
                "Use ISO format YYYY-MM-DD. If unclear, iso_date must be null."
            ),
            user_prompt=(
                f"Timezone: {timezone_name}\n"
                f"Reference date: {reference_date.isoformat()}\n"
                f"User language: {language or 'unknown'}\n"
                f"User message: {message}"
            ),
        )
        if not isinstance(payload, dict):
            return None
        iso_date = payload.get("iso_date")
        return str(iso_date) if iso_date else None

    async def parse_time(
        self,
        message: str,
        timezone_name: str,
        reference_date: date,
        language: str | None = None,
    ) -> str | None:
        if not self.client:
            return None

        payload = await self._json_completion(
            system_prompt=(
                "Extract one appointment time. Return JSON only with keys iso_time and confidence. "
                "Use 24-hour HH:MM format. If unclear, iso_time must be null."
            ),
            user_prompt=(
                f"Timezone: {timezone_name}\n"
                f"Reference date: {reference_date.isoformat()}\n"
                f"User language: {language or 'unknown'}\n"
                f"User message: {message}"
            ),
        )
        if not isinstance(payload, dict):
            return None
        iso_time = payload.get("iso_time")
        return str(iso_time) if iso_time else None

    async def localize_text(self, text: str, target_language: str | None) -> str:
        if not target_language or target_language == "english":
            return text
        if not self.client:
            return text

        response = await self.client.chat.completions.create(
            model=self.settings.llm_model,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Translate the assistant message into the requested target language. "
                        "Keep formatting, bulleting, dates, times, and brand names intact."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Target language: {target_language}\nMessage:\n{text}",
                },
            ],
        )
        return response.choices[0].message.content or text

    async def _json_completion(self, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        if not self.client:
            return None
        response = await self.client.chat.completions.create(
            model=self.settings.llm_model,
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = response.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return None
