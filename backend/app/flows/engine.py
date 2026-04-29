from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from typing import Any, Sequence
from zoneinfo import ZoneInfo

import dateparser

from app.core.config import Settings
from app.core.enums import ConversationStep, UserIntent
from app.db.models.customer import Customer
from app.db.models.salon import Salon, SalonService
from app.db.models.appointment import Appointment
from app.flows.definitions import NO_TOKENS, RESTART_TOKENS, RESET_TOKENS, YES_TOKENS, GREETING_TOKENS, build_flow_config
from app.llm.service import LLMService
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState
from app.flows.handlers.booking import handle_booking
from app.flows.handlers.scheduling import handle_scheduling
from app.flows.handlers.management import handle_management


class ConversationEngine:
    # Map language names to ISO 639-1 codes for dateparser
    LANG_ISO_MAP = {
        'english': 'en', 'hinglish': 'en', 'hindi': 'hi', 'telugu': 'te',
        'spanish': 'es', 'french': 'fr', 'german': 'de', 'arabic': 'ar',
        'urdu': 'ur', 'tamil': 'ta', 'bengali': 'bn', 'punjabi': 'pa',
    }

    def __init__(
        self,
        llm_service: LLMService,
        settings: Settings,
        appointment_service: Any | None = None,
    ) -> None:
        self.llm_service = llm_service
        self.settings = settings
        self.appointment_service = appointment_service

    @staticmethod
    def _advance_step(state: ConversationState, new_step: ConversationStep) -> None:
        """Advance to a new step and reset attempt_count for the new question."""
        state.previous_step = state.step
        state.step = new_step
        state.attempt_count = 0  # Reset strike counter for the new question

    async def process_message(
        self,
        state: ConversationState,
        message_text: str,
        salon: Salon,
        services: Sequence[SalonService],
        customer: Customer | None = None,
    ) -> tuple[FlowResult, bool]:
        """
        Process an incoming message and return the flow result.
        
        Returns:
            tuple[FlowResult, bool]: The flow result and a boolean indicating
                                     if the state was reset (for caller to handle).
        """
        flow_config = build_flow_config(salon.flow_config)
        cleaned_text = (message_text or "").strip()
        
        # Track if state was reset for proper handling by caller
        state_was_reset = False

        # Handle reset tokens - create new state but signal caller to clear old state
        # Only reset if the conversation has already progressed (not at GREETING step)
        # This prevents clearing state for brand new conversations
        if cleaned_text.casefold() in RESET_TOKENS and state.step != ConversationStep.GREETING:
            state_was_reset = True
            state = ConversationState(
                salon_id=state.salon_id,
                channel=state.channel,
                external_user_id=state.external_user_id,
            )

        # Handle restart tokens and restart_flow callback - always reset to GREETING
        if cleaned_text.casefold() in RESTART_TOKENS or cleaned_text == "restart_flow":
            state_was_reset = True
            state = ConversationState(
                salon_id=state.salon_id,
                channel=state.channel,
                external_user_id=state.external_user_id,
            )

        # Handle "Go Back" navigation
        if cleaned_text.casefold() in {"back", "go back", "previous", "⬅️", "⬅️ back", "go_back"} and state.previous_step:
            state.step = state.previous_step
            state.previous_step = None
            # Re-process this step by falling through to the step handler below
            # We'll let the step handlers below generate the appropriate response

        # Dispatch to focused step handlers — all helpers remain on ConversationEngine.
        for _handler in (handle_booking, handle_scheduling, handle_management):
            _result = await _handler(
                self, state, cleaned_text, salon, services, flow_config, state_was_reset
            )
            if _result is not None:
                return _result

        return FlowResult(
            state=state,
            messages=[OutboundInstruction(text="Reply HI to start a new booking.")],
            clear_state=True,
        ), state_was_reset

    async def _resolve_choice(
        self,
        message_text: str,
        options: list[dict[str, Any]],
        field_name: str,
        language_hint: str | None,
    ) -> dict[str, Any] | None:
        if message_text.isdigit():
            index = int(message_text) - 1
            if 0 <= index < len(options):
                return options[index]

        normalized = message_text.casefold()
        for option in options:
            candidates = [option["label"], *option.get("aliases", [])]
            if any(normalized == candidate.casefold() or candidate.casefold() in normalized for candidate in candidates):
                return option

        match_id = await self.llm_service.classify_option(
            message_text,
            options=options,
            field_name=field_name,
            language=language_hint,
        )
        if not match_id:
            return None
        return next((option for option in options if option["id"] == match_id), None)

    async def _resolve_service(
        self,
        message_text: str,
        services: Sequence[SalonService],
        language_hint: str | None,
    ) -> SalonService | None:
        if message_text.isdigit():
            index = int(message_text) - 1
            if 0 <= index < len(services):
                return services[index]

        normalized = message_text.casefold()
        for service in services:
            aliases = [service.name, service.code, *service.service_config.get("aliases", [])]
            if any(normalized == alias.casefold() or alias.casefold() in normalized for alias in aliases if alias):
                return service

        options = [
            {"id": str(service.id), "label": service.name, "aliases": [service.code, *service.service_config.get("aliases", [])]}
            for service in services
        ]
        match_id = await self.llm_service.classify_option(
            message_text,
            options=options,
            field_name="service",
            language=language_hint,
        )
        if not match_id:
            return None
        return next((service for service in services if str(service.id) == match_id), None)

    async def _resolve_yes_no(self, message_text: str, language_hint: str | None) -> bool | None:
        normalized = message_text.casefold()
        if normalized in YES_TOKENS:
            return True
        if normalized in NO_TOKENS:
            return False

        options = [
            {"id": "yes", "label": "Yes", "aliases": sorted(YES_TOKENS)},
            {"id": "no", "label": "No", "aliases": sorted(NO_TOKENS)},
        ]
        match_id = await self.llm_service.classify_option(
            message_text,
            options=options,
            field_name="yes_no",
            language=language_hint,
        )
        if match_id == "yes":
            return True
        if match_id == "no":
            return False
        return None

    async def _parse_date(self, message_text: str, timezone_name: str, language_hint: str | None) -> date | None:
        """Parse date — tries dateparser first (fast), falls back to LLM for complex expressions."""
        today = datetime.now(ZoneInfo(timezone_name)).date()
        lang_code = self.LANG_ISO_MAP.get((language_hint or '').lower())

        # === PASS 1: dateparser for simple formats ===
        # Handles: "tomorrow", "next Monday", "25/04", "June 15", etc.
        parsed = dateparser.parse(
            message_text,
            settings={
                'PREFER_DATES_FROM': 'future',
                'DATE_ORDER': 'DMY',
                'RETURN_AS_TIMEZONE_AWARE': False,
                'RELATIVE_BASE': datetime.now(ZoneInfo(timezone_name)),
            },
            languages=[lang_code] if lang_code else None,
        )

        if parsed:
            result_date = parsed.date() if hasattr(parsed, 'date') else parsed
            if result_date >= today:
                return result_date

        # === PASS 2: LLM for complex natural language ===
        # Handles: "3 mondays after 15 june", "3 days after 3rd saturday of june", etc.
        # These are too complex for dateparser but LLMs handle them well.
        reference_date = today
        llm_result = await self.llm_service.parse_date(
            message_text,
            timezone_name,
            reference_date,
            language_hint,
        )
        if llm_result:
            try:
                llm_date = date.fromisoformat(llm_result)
                if llm_date >= today:
                    return llm_date
            except (ValueError, TypeError):
                pass

        return None

    async def _parse_time(
        self,
        message_text: str,
        timezone_name: str,
        reference_date: date,
        language_hint: str | None,
    ) -> time | None:
        """Parse time using dateparser library - handles natural language like 'half past 5', 'evening', etc."""
        cleaned = message_text.strip().lower()

        # Pre-check 0: Relative time expressions
        # e.g., "8 minutes after 7" → 7:08, "7 minutes before 8" → 7:53
        # "quarter after 5" → 5:15, "half past 3" → 3:30
        # dateparser misinterprets these, so we handle them explicitly.
        rel_match = re.match(
            r'^(\d{1,2})\s*minutes?\s+(?:after|past)\s+(\d{1,2})$',
            cleaned,
        )
        if rel_match:
            minutes = int(rel_match.group(1))
            hour = int(rel_match.group(2))
            if 1 <= hour <= 12 and 0 <= minutes <= 59:
                if hour != 12:
                    hour += 12
                return time(hour, minutes)
            elif 13 <= hour <= 23 and 0 <= minutes <= 59:
                return time(hour, minutes)

        rel_match = re.match(
            r'^(\d{1,2})\s*minutes?\s+before\s+(\d{1,2})$',
            cleaned,
        )
        if rel_match:
            minutes = int(rel_match.group(1))
            hour = int(rel_match.group(2))
            if 1 <= hour <= 12 and 0 <= minutes <= 59:
                pm_hour = hour if hour == 12 else hour + 12
                total = pm_hour * 60 - minutes
                h, m = divmod(total, 60)
                return time(h, m)
            elif 13 <= hour <= 23 and 0 <= minutes <= 59:
                total = hour * 60 - minutes
                h, m = divmod(total, 60)
                return time(h, m)

        # Handle "quarter after X" → X:15
        rel_match = re.match(r'^quarter\s+(?:after|past)\s+(\d{1,2})$', cleaned)
        if rel_match:
            hour = int(rel_match.group(1))
            if 1 <= hour <= 12:
                if hour != 12:
                    hour += 12
                return time(hour, 15)

        # Handle "half past X" → X:30
        rel_match = re.match(r'^half\s+past\s+(\d{1,2})$', cleaned)
        if rel_match:
            hour = int(rel_match.group(1))
            if 1 <= hour <= 12:
                if hour != 12:
                    hour += 12
                return time(hour, 30)

        # Pre-check 1: Dot-separated time formats (H.M, HH.MM, etc.)
        # e.g., "3.3" → 15:03, "5.30" → 17:30, "9.15" → 21:15
        # dateparser misinterprets these as dates (March 3rd), so we handle them first
        match = re.match(r'^(\d{1,2})\.(\d{1,2})$', cleaned)
        if match:
            hour, minute = int(match.group(1)), int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                # In booking context, hours 1-12 = PM (12 stays as 12 = noon)
                if 1 <= hour < 12:
                    hour += 12
                return time(hour, minute)

        # Pre-check 2: Colon-separated time (H:MM, HH:MM)
        match = re.match(r'^(\d{1,2}):(\d{1,2})$', cleaned)
        if match:
            hour, minute = int(match.group(1)), int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                return time(hour, minute)

        # Pre-check 3: Hour with AM/PM
        match = re.match(r'^(\d{1,2})\s*(am|pm)$', cleaned)
        if match:
            hour = int(match.group(1))
            period = match.group(2)
            if period == 'pm' and hour != 12:
                hour += 12
            elif period == 'am' and hour == 12:
                hour = 0
            if 0 <= hour <= 23:
                return time(hour, 0)

        # Pre-check 4: Single digit (1-12) - assume PM (12 stays as 12 = noon)
        match = re.match(r'^(\d{1,2})$', cleaned)
        if match:
            hour = int(match.group(1))
            if 1 <= hour < 12:
                return time(hour + 12, 0)
            elif 12 <= hour <= 23:
                return time(hour, 0)

        # === PASS 2: dateparser for natural language ===
        # Handles: "evening", "afternoon", "lunch time", etc.
        # NOTE: relative expressions like "8 minutes after 7" are handled
        # by pre-checks above. dateparser only handles what's left.
        lang_code = self.LANG_ISO_MAP.get((language_hint or '').lower())

        # Provide a relative base so dateparser can resolve "tonight", "evening" etc.
        now = datetime.now(ZoneInfo(timezone_name))

        parsed = dateparser.parse(
            message_text,
            settings={
                'PREFER_DATES_FROM': 'future',
                'RETURN_AS_TIMEZONE_AWARE': False,
                'RELATIVE_BASE': now,
            },
            languages=[lang_code] if lang_code else None,
        )

        if parsed:
            return parsed.time()

        # === PASS 3: LLM for anything neither regex nor dateparser handled ===
        # Handles: "quarter to six", "twenty past four", or any other natural phrasing.
        llm_result = await self.llm_service.parse_time(
            message_text,
            timezone_name,
            reference_date,
            language_hint,
        )
        if llm_result:
            try:
                # LLM returns "HH:MM" in 24-hour format
                parts = llm_result.split(":")
                if len(parts) == 2:
                    h, m = int(parts[0]), int(parts[1])
                    if 0 <= h <= 23 and 0 <= m <= 59:
                        return time(h, m)
            except (ValueError, TypeError):
                pass

        return None

    @staticmethod
    def _get_business_hours(salon: Salon) -> tuple[int, int]:
        """Return (start_hour, end_hour) from salon config, defaulting to 9–18."""
        start_hour, end_hour = 9, 18
        if hasattr(salon, "flow_config") and salon.flow_config:
            start_hour = int(salon.flow_config.get("opening_hour", 9))
            end_hour = int(salon.flow_config.get("closing_hour", 18))
        elif hasattr(salon, "business_hours") and salon.business_hours:
            try:
                hours_str = str(salon.business_hours)
                if "-" in hours_str:
                    start_str, end_str = hours_str.split("-")
                    start_hour = int(start_str.split(":")[0])
                    end_hour = int(end_str.split(":")[0])
            except (ValueError, AttributeError):
                pass
        return start_hour, end_hour

    @staticmethod
    def _build_date_buttons(
        timezone_name: str,
        include_back: bool = False,
        fully_booked_dates: set | None = None,
    ) -> tuple[list[dict[str, str]], str]:
        """Build the 7-day quick-date button list.

        Fully-booked dates are excluded from buttons and listed in the returned
        ``booked_text`` fragment (with ~strikethrough~ Telegram/WhatsApp formatting)
        so callers can append it to the message body as social proof.

        Returns ``(buttons, booked_text)`` — ``booked_text`` is ``""`` when no
        dates are fully booked.
        """
        today = datetime.now(ZoneInfo(timezone_name)).date()
        buttons: list[dict[str, str]] = []
        booked_labels: list[str] = []

        for i in range(7):
            target_date = today + timedelta(days=i)
            if i == 0:
                label = "Today"
            elif i == 1:
                label = "Tomorrow"
            else:
                label = target_date.strftime("%a %d %b")

            if fully_booked_dates and target_date in fully_booked_dates:
                booked_labels.append(f"~{label}~")
            else:
                buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})

        if include_back:
            buttons.append({"label": "⬅️ Back", "callback": "go_back"})
        buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})

        booked_text = (
            "\n\n❌ *Fully booked:* " + "  ".join(booked_labels)
            if booked_labels
            else ""
        )
        return buttons, booked_text

    @staticmethod
    def _build_time_buttons(
        start_hour: int,
        end_hour: int,
        booked_hours: set[int] | None = None,
    ) -> tuple[list[dict[str, str]], str]:
        """Build hourly time-slot buttons from start_hour up to (not including) end_hour.

        Booked hours are excluded from buttons and listed in the returned
        ``booked_text`` fragment with ~strikethrough~ formatting.

        Returns ``(buttons, booked_text)`` — ``booked_text`` is ``""`` when all
        slots are available.
        """
        buttons: list[dict[str, str]] = []
        booked_labels: list[str] = []

        for hour in range(start_hour, end_hour):
            time_obj = time(hour=hour, minute=0)
            label = time_obj.strftime("%I:%M %p").lstrip("0")
            if booked_hours and hour in booked_hours:
                booked_labels.append(f"~{label}~")
            else:
                buttons.append({"label": label, "callback": f"time_{hour:02d}:00"})

        buttons.append({"label": "⬅️ Back", "callback": "go_back"})
        buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})

        booked_text = (
            "\n\n⏳ *Already taken:* " + "  ".join(booked_labels)
            if booked_labels
            else ""
        )
        return buttons, booked_text

    @staticmethod
    def _choice_prompt(header: str, options: list[dict[str, Any]]) -> str:
        lines = [header + ":"]
        for index, option in enumerate(options, start=1):
            lines.append(f"{index}. {option['label']}")
        return "\n".join(lines)

    @staticmethod
    def _service_prompt(services: Sequence[SalonService], header: str = "Which service do you need") -> str:
        lines = [header + ":"]
        for index, service in enumerate(services, start=1):
            lines.append(f"{index}. {service.name}")
        return "\n".join(lines)

    @staticmethod
    def _find_service_by_id(services: Sequence[SalonService], service_id: str | None) -> SalonService | None:
        if not service_id:
            return None
        return next((service for service in services if str(service.id) == service_id), None)

    async def _handle_faq_fallback(self, message_text: str, current_step: ConversationStep, salon: Salon) -> FlowResult | None:
        """
        Check if user asked a FAQ question. If yes, answer it and remind them of current step.
        Only fires when date/time parsing fails - avoids LLM cost for valid inputs.
        Returns None if not a FAQ (proceed with normal error handling).
        """
        if not self.llm_service.client:
            return None  # LLM not available, skip FAQ check
        
        # Filter out single-character, punctuation-only, or very short inputs
        # e.g., "?", ".", "!!", "ok", "yes", "no" are not FAQs
        stripped = message_text.strip()
        if len(stripped) <= 1:
            return None  # Too short to be a real question
        if re.match(r'^[?!,.]+$', stripped):
            return None  # Just punctuation
        if stripped.lower() in {'ok', 'okay', 'yes', 'no', 'sure', 'yeah', 'yep', 'nah'}:
            return None  # Common conversational tokens, not FAQs
        if len(stripped.split()) == 1 and stripped.lower() in {'help', 'hello', 'hi', 'hey'}:
            return None  # Greetings, not FAQs

        # Ask LLM to classify: is this a FAQ or gibberish?
        classification = await self.llm_service._json_completion(
            system_prompt=(
                "You are a conversation classifier. Determine if the user is asking a general question about the salon "
                "or if it's gibberish/off-topic. Return JSON with keys: "
                "  - is_faq: true if it's a valid salon question, false if gibberish/off-topic"
                "  - answer: brief answer to the question (or null if not a FAQ)"
                "Context: This is a beauty salon booking assistant."
            ),
            user_prompt=f"User message: {message_text}",
        )
        
        if not isinstance(classification, dict):
            return None
        
        is_faq = classification.get("is_faq", False)
        answer = classification.get("answer")
        
        if not is_faq or not answer:
            return None  # Not a FAQ, proceed with normal error handling
        
        # Build reminder based on current step
        step_reminders = {
            ConversationStep.APPOINTMENT_DATE: "Please choose your appointment date:",
            ConversationStep.APPOINTMENT_TIME: "Please choose your preferred time:",
            ConversationStep.DATE_CONFIRMATION: "Please confirm the date above:",
            ConversationStep.TIME_CONFIRMATION: "Please confirm the time above:",
            ConversationStep.CUSTOMER_NAME: "Please provide your name:",
            ConversationStep.SERVICE: "Please choose a service:",
            ConversationStep.EMAIL: "Please provide your email:",
            ConversationStep.PHONE_NUMBER: "Please share your phone number (at least 10 digits):",
            ConversationStep.CONFIRMATION: "Please confirm your booking:",
        }
        reminder = step_reminders.get(current_step, "Please continue with your booking:")
        
        return FlowResult(
            state=ConversationState(  # Don't modify state, just return answer + reminder
                salon_id=salon.id if hasattr(salon, 'id') else "",
                channel=getattr(salon, 'channel', None) or getattr(self, 'channel', None),
                external_user_id="",
            ),
            messages=[
                OutboundInstruction(text=f"💡 {answer}\n\n{reminder}"),
            ],
        )

    @staticmethod
    def _invalid_reply(state: ConversationState, prompt: str, buttons: list[dict[str, Any]] | None = None) -> tuple[FlowResult, bool]:
        """Return an invalid reply result with incremented attempt count."""
        state.attempt_count += 1
        return FlowResult(state=state, messages=[OutboundInstruction(text=prompt, buttons=buttons or [])]), False
