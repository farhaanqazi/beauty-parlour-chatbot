from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Sequence
from zoneinfo import ZoneInfo

from dateutil import parser as date_parser

from app.core.config import Settings
from app.core.enums import ConversationStep
from app.db.models.salon import Salon, SalonService
from app.flows.definitions import NO_TOKENS, RESET_TOKENS, YES_TOKENS, build_flow_config
from app.llm.service import LLMService
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState


class ConversationEngine:
    def __init__(self, llm_service: LLMService, settings: Settings) -> None:
        self.llm_service = llm_service
        self.settings = settings

    async def process_message(
        self,
        state: ConversationState,
        message_text: str,
        salon: Salon,
        services: Sequence[SalonService],
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
        if cleaned_text.casefold() in RESET_TOKENS:
            state_was_reset = True
            state = ConversationState(
                salon_id=state.salon_id,
                channel=state.channel,
                external_user_id=state.external_user_id,
            )

        if state.step == ConversationStep.GREETING:
            state.step = ConversationStep.LANGUAGE
            # Combine greeting and language prompt into ONE message with buttons
            greeting_text = flow_config["greeting"].format(salon_name=salon.name)
            language_prompt = "Choose your language:"
            # Create buttons for languages
            lang_buttons = [{"label": lang["label"], "callback": f"lang_{lang['id']}"} for lang in flow_config["languages"]]
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"{greeting_text}\n\n{language_prompt}",
                        buttons=lang_buttons,
                    ),
                ],
            ), state_was_reset

        if state.step == ConversationStep.LANGUAGE:
            language = await self._resolve_choice(
                cleaned_text,
                flow_config["languages"],
                field_name="language",
                language_hint=None,
            )
            if not language:
                result, _ = self._invalid_reply(state, self._choice_prompt("Please choose a valid language", flow_config["languages"]))
                return result, state_was_reset
            # Acknowledge language choice, then move directly to SERVICE (skip marriage type)
            state.slots.language = language["id"]
            state.step = ConversationStep.SERVICE
            # Create buttons for services
            service_buttons = [{"label": svc.name, "callback": f"svc_{svc.id}"} for svc in services]
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"Great! I'll continue in {language['label']}.\n\nWhich service do you need:",
                        buttons=service_buttons,
                    )
                ],
            ), state_was_reset

        if state.step == ConversationStep.SERVICE:
            # Handle button callback (svc_ID format)
            if cleaned_text.startswith("svc_"):
                service_id = cleaned_text.replace("svc_", "")
                service = self._find_service_by_id(services, service_id)
            else:
                service = await self._resolve_service(cleaned_text, services, state.slots.language)
            
            if not service:
                result, _ = self._invalid_reply(state, self._service_prompt(services, header="Please choose a valid service"))
                return result, state_was_reset
            state.slots.service_id = str(service.id)
            state.slots.service_name = service.name
            # Skip sample images, go directly to date selection with quick date buttons
            state.step = ConversationStep.APPOINTMENT_DATE
            today = datetime.now(ZoneInfo(salon.timezone)).date()
            date_buttons = [
                {"label": "Today", "callback": f"date_{today.isoformat()}"},
                {"label": "Tomorrow", "callback": f"date_{(today + timedelta(days=1)).isoformat()}"},
                {"label": "Day after tomorrow", "callback": f"date_{(today + timedelta(days=2)).isoformat()}"},
            ]
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="Please choose your preferred appointment date:",
                        buttons=date_buttons,
                    )
                ],
            ), state_was_reset

        if state.step == ConversationStep.SAMPLE_IMAGES:
            wants_samples = await self._resolve_yes_no(cleaned_text, state.slots.language)
            if wants_samples is None:
                result, _ = self._invalid_reply(
                    state,
                    "Please reply YES if you want sample images, or NO to continue without them.",
                )
                return result, state_was_reset
            state.slots.wants_sample_images = wants_samples
            state.step = ConversationStep.APPOINTMENT_DATE
            selected_service = self._find_service_by_id(services, state.slots.service_id)
            instructions: list[OutboundInstruction] = []
            if wants_samples and selected_service and selected_service.sample_image_urls:
                instructions.append(
                    OutboundInstruction(
                        text=f"Here are sample images for {selected_service.name}.",
                        media_urls=selected_service.sample_image_urls[: self.settings.max_sample_images],
                    )
                )
            elif wants_samples:
                instructions.append(
                    OutboundInstruction(text="Sample images are not available right now for this service.")
                )
            instructions.append(OutboundInstruction(text="Please share your preferred appointment date."))
            return FlowResult(state=state, messages=instructions), state_was_reset

        if state.step == ConversationStep.APPOINTMENT_DATE:
            # Handle button callback (date_YYYY-MM-DD format)
            if cleaned_text.startswith("date_"):
                date_str = cleaned_text.replace("date_", "")
                try:
                    appointment_date = date.fromisoformat(date_str)
                except ValueError:
                    appointment_date = None
            else:
                appointment_date = await self._parse_date(cleaned_text, salon.timezone, state.slots.language)

            if not appointment_date:
                result, _ = self._invalid_reply(
                    state,
                    "Please send a valid date, for example 25/03/2026 or next Monday.",
                )
                return result, state_was_reset
            
            # --- Validate 3-month advance booking limit HERE (not at confirmation) ---
            from datetime import timedelta as td
            max_booking_date = datetime.now(ZoneInfo(salon.timezone)).date() + td(days=90)
            if appointment_date > max_booking_date:
                # Date is too far in the future - show error and date buttons immediately
                today = datetime.now(ZoneInfo(salon.timezone)).date()
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(text="Appointments can only be booked up to 3 months in advance."),
                        OutboundInstruction(
                            text="Please choose a date within the next 3 months:",
                            buttons=[
                                {"label": "Today", "callback": f"date_{today.isoformat()}"},
                                {"label": "Tomorrow", "callback": f"date_{(today + td(days=1)).isoformat()}"},
                                {"label": "Day after tomorrow", "callback": f"date_{(today + td(days=2)).isoformat()}"},
                            ],
                        ),
                    ],
                ), state_was_reset
            
            state.slots.appointment_date = appointment_date
            state.step = ConversationStep.APPOINTMENT_TIME
            # Add quick time buttons
            time_buttons = [
                {"label": "9:00 AM", "callback": "time_09:00"},
                {"label": "11:00 AM", "callback": "time_11:00"},
                {"label": "1:00 PM", "callback": "time_13:00"},
                {"label": "3:00 PM", "callback": "time_15:00"},
                {"label": "5:00 PM", "callback": "time_17:00"},
            ]
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="What time would you like to book?",
                        buttons=time_buttons,
                    )
                ],
            ), state_was_reset

        if state.step == ConversationStep.APPOINTMENT_TIME:
            if not state.slots.appointment_date:
                state.step = ConversationStep.APPOINTMENT_DATE
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="Please share the appointment date first.")],
                ), state_was_reset

            # Handle button callback (time_HH:MM format)
            if cleaned_text.startswith("time_"):
                time_str = cleaned_text.replace("time_", "")
                try:
                    appointment_time = time.fromisoformat(time_str)
                except ValueError:
                    appointment_time = None
            else:
                appointment_time = await self._parse_time(
                    cleaned_text,
                    salon.timezone,
                    state.slots.appointment_date,
                    state.slots.language,
                )
            
            if not appointment_time:
                result, _ = self._invalid_reply(
                    state,
                    "Please send a valid time, for example 5:30 PM or 17:30.",
                )
                return result, state_was_reset

            # Fix issue #4: Cache current time to avoid race condition in comparison
            current_time = datetime.now(ZoneInfo(salon.timezone))

            appointment_at = datetime.combine(
                state.slots.appointment_date,
                appointment_time,
                tzinfo=ZoneInfo(salon.timezone),
            )
            if appointment_at <= current_time:
                result, _ = self._invalid_reply(
                    state,
                    "That time is already in the past. Please choose a future time.",
                )
                return result, state_was_reset

            state.slots.appointment_time = appointment_time
            state.step = ConversationStep.CONFIRMATION
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=flow_config["confirmation_template"].format(
                            service=state.slots.service_name,
                            date=state.slots.appointment_date.strftime("%d %b %Y"),
                            time=appointment_time.strftime("%I:%M %p"),
                        ),
                        buttons=[
                            {"label": "✅ YES", "callback": "confirm_yes"},
                            {"label": "❌ NO", "callback": "confirm_no"},
                        ],
                    )
                ],
            ), state_was_reset

        if state.step == ConversationStep.CONFIRMATION:
            # Handle button callbacks
            if cleaned_text == "confirm_yes":
                confirmation = True
            elif cleaned_text == "confirm_no":
                confirmation = False
            else:
                confirmation = await self._resolve_yes_no(cleaned_text, state.slots.language)
            
            if confirmation is None:
                result, _ = self._invalid_reply(
                    state,
                    "Please tap YES to confirm your booking or NO to cancel it.",
                )
                return result, state_was_reset
            if not confirmation:
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="The booking was cancelled. Reply HI whenever you want to start again.")],
                    clear_state=True,
                ), state_was_reset
            state.step = ConversationStep.COMPLETE
            state.is_complete = True
            return FlowResult(state=state, should_create_appointment=True, clear_state=True), state_was_reset

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
        today = datetime.now(ZoneInfo(timezone_name)).date()
        relative_map = {
            "today": today,
            "tomorrow": today + timedelta(days=1),
            "day after tomorrow": today + timedelta(days=2),
        }
        lowered = message_text.casefold()
        if lowered in relative_map:
            return relative_map[lowered]

        try:
            parsed = date_parser.parse(
                message_text,
                dayfirst=True,
                fuzzy=True,
                default=datetime.now(ZoneInfo(timezone_name)),
            )
            if parsed.date() >= today:
                return parsed.date()
        except (ValueError, OverflowError):
            pass

        llm_date = await self.llm_service.parse_date(
            message_text,
            timezone_name=timezone_name,
            reference_date=today,
            language=language_hint,
        )
        if not llm_date:
            return None
        try:
            parsed_date = date.fromisoformat(llm_date)
        except ValueError:
            return None
        return parsed_date if parsed_date >= today else None

    async def _parse_time(
        self,
        message_text: str,
        timezone_name: str,
        reference_date: date,
        language_hint: str | None,
    ) -> time | None:
        try:
            parsed = date_parser.parse(
                message_text,
                fuzzy=True,
                default=datetime.combine(reference_date, time(hour=9, minute=0)),
            )
            return parsed.time().replace(second=0, microsecond=0)
        except (ValueError, OverflowError):
            pass

        llm_time = await self.llm_service.parse_time(
            message_text,
            timezone_name=timezone_name,
            reference_date=reference_date,
            language=language_hint,
        )
        if not llm_time:
            return None
        try:
            parsed_time = time.fromisoformat(llm_time)
        except ValueError:
            return None
        return parsed_time.replace(second=0, microsecond=0)

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

    @staticmethod
    def _invalid_reply(state: ConversationState, prompt: str) -> tuple[FlowResult, bool]:
        """Return an invalid reply result with incremented attempt count."""
        state.attempt_count += 1
        return FlowResult(state=state, messages=[OutboundInstruction(text=prompt)]), False
