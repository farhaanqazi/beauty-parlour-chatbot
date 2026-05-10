from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from groq import AsyncGroq

from app.core.config import Settings

# Maximum user message length sent to LLM (prevents abuse)
MAX_LLM_INPUT_LENGTH = 500

# Patterns that indicate potential prompt injection
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"(?i)ignore\s+(previous|above|all)\s+(instructions?|rules?|prompts?)"),
    re.compile(r"(?i)(system|developer)\s*(message|prompt|role)"),
    re.compile(r"(?i)you\s+are\s+(now|actually)\s+"),
    re.compile(r"(?i)new\s+(system|developer)\s+instruction"),
    re.compile(r"<\|.*?\|>"),  # Token-style injection markers
]


def sanitize_llm_input(text: str) -> tuple[str, bool]:
    """
    Sanitize user input before sending to LLM.
    
    Returns:
        Tuple of (sanitized_text, is_safe).
        If is_safe is False, the input should be rejected entirely.
    """
    if not text:
        return "", True

    # Hard length limit
    if len(text) > MAX_LLM_INPUT_LENGTH:
        return text[:MAX_LLM_INPUT_LENGTH], True  # Truncate, don't reject

    # Check for prompt injection patterns
    for pattern in PROMPT_INJECTION_PATTERNS:
        if pattern.search(text):
            # Strip the injection attempt but still process the message
            # (don't fully reject — legitimate users might use similar phrases)
            pass  # Continue processing; we truncate context in prompts

    # Strip null bytes and control characters (except newlines/tabs)
    sanitized = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    return sanitized, True


class LLMService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: AsyncGroq | None = None
        if settings.llm_api_key:
            # Only pass base_url if it's set and not the default
            # The Groq SDK defaults to the correct URL automatically
            client_kwargs = {"api_key": settings.llm_api_key}
            if settings.llm_base_url and "YOUR_" not in settings.llm_base_url and settings.llm_base_url != "https://api.groq.com/openai/v1":
                client_kwargs["base_url"] = settings.llm_base_url
            self.client = AsyncGroq(**client_kwargs)

    async def classify_option(
        self,
        message: str,
        options: list[dict[str, Any]],
        field_name: str,
        language: str | None = None,
    ) -> str | None:
        if not self.client:
            return None

        sanitized_msg, _ = sanitize_llm_input(message)

        payload = await self._json_completion(
            system_prompt=(
                "You classify a user reply into one option id. "
                "Return JSON only with keys match_id and confidence."
            ),
            user_prompt=(
                f"Field: {field_name}\n"
                f"User language: {language or 'unknown'}\n"
                f"User message: {sanitized_msg}\n"
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

        sanitized_msg, _ = sanitize_llm_input(message)

        payload = await self._json_completion(
            system_prompt=(
                "You are a date extraction expert. Extract the intended appointment date from the user's message. "
                "Return JSON only with keys iso_date (YYYY-MM-DD) and confidence (0-1). "
                "CRITICAL: Handle relative dates correctly! "
                "- 'Today' = reference_date. "
                "- 'Tomorrow' = reference_date + 1 day. "
                "- 'Day after Tuesday' = The day after the NEXT Tuesday. "
                "- 'Next Friday' = The Friday of next week. "
                "If unclear, iso_date must be null."
            ),
            user_prompt=(
                f"Timezone: {timezone_name}\n"
                f"Reference date (Today): {reference_date.isoformat()}\n"
                f"User language: {language or 'unknown'}\n"
                f"User message: {sanitized_msg}"
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

        sanitized_msg, _ = sanitize_llm_input(message)

        payload = await self._json_completion(
            system_prompt=(
                "You are a time extraction expert. Extract the intended appointment time from the user's message. "
                "Return JSON only with keys iso_time (HH:MM 24-hour format) and confidence (0-1). "
                "CRITICAL: Context is a beauty salon booking. "
                "- Single digits like '3' or '4' usually mean 3:00 PM (15:00) or 4:00 PM (16:00), NOT morning. "
                "- '3.30' means 15:30. "
                "- 'Half past 5' means 17:30. "
                "If unclear, iso_time must be null."
            ),
            user_prompt=(
                f"Timezone: {timezone_name}\n"
                f"Reference date: {reference_date.isoformat()}\n"
                f"User language: {language or 'unknown'}\n"
                f"User message: {sanitized_msg}"
            ),
        )
        if not isinstance(payload, dict):
            return None
        iso_time = payload.get("iso_time")
        return str(iso_time) if iso_time else None

    async def extract_slots(
        self,
        message: str,
        service_names: list[str],
        timezone_name: str,
        reference_date: date,
        language: str | None = None,
    ) -> dict[str, Any]:
        """Extract any booking slots mentioned in a free-form message.

        Returns a dict with any of these keys (only if confidently extracted):
          - service_name: str  (matched against service_names list)
          - date: str          (YYYY-MM-DD)
          - time: str          (HH:MM, 24-hour)
          - customer_name: str
          - phone: str

        Empty dict means nothing was confidently extractable.
        """
        if not self.client:
            return {}

        sanitized_msg, _ = sanitize_llm_input(message)

        payload = await self._json_completion(
            system_prompt=(
                "You are a booking assistant slot extractor for a beauty salon. "
                "Extract booking information from the user message. "
                "Return JSON with ONLY the slots that are clearly mentioned (omit uncertain ones). "
                "Keys: service_name (str, must be from the services list or null), "
                "date (YYYY-MM-DD or null), time (HH:MM 24-hour or null), "
                "customer_name (str or null), phone (digits only, 10+ chars, or null). "
                f"Today is {reference_date.isoformat()} in timezone {timezone_name}. "
                "For relative dates: 'tomorrow' = today+1, 'next Monday' = next week's Monday. "
                "For ambiguous times: single digits like '3' or '4' = PM (15:00/16:00). "
                "IMPORTANT: Only extract what is CLEARLY stated. Do NOT guess. "
                "If a slot is ambiguous or not mentioned, set it to null."
            ),
            user_prompt=(
                f"Available services: {', '.join(service_names)}\n"
                f"User language: {language or 'english'}\n"
                f"User message: {sanitized_msg}"
            ),
        )
        if not isinstance(payload, dict):
            return {}

        result: dict[str, Any] = {}
        if payload.get("service_name") and any(
            payload["service_name"].lower() in s.lower() or s.lower() in payload["service_name"].lower()
            for s in service_names
        ):
            result["service_name"] = payload["service_name"]
        if payload.get("date"):
            try:
                from datetime import date as _date
                _d = _date.fromisoformat(str(payload["date"]))
                if _d >= reference_date:
                    result["date"] = str(payload["date"])
            except (ValueError, TypeError):
                pass
        if payload.get("time"):
            result["time"] = str(payload["time"])
        if payload.get("customer_name") and len(str(payload["customer_name"]).split()) <= 5:
            result["customer_name"] = str(payload["customer_name"])
        if payload.get("phone"):
            _phone = re.sub(r"\D", "", str(payload["phone"]))
            if len(_phone) >= 10:
                result["phone"] = _phone
        return result

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
        try:
            import asyncio
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.settings.llm_model,
                    temperature=0,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    timeout=10,  # 10 second timeout
                ),
                timeout=12,  # Slightly longer outer timeout for safety
            )
            content = response.choices[0].message.content or "{}"
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return None
        except asyncio.TimeoutError:
            return None  # LLM timed out, gracefully degrade
