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

        if state.step == ConversationStep.GREETING:
            # STRICT MODE: If we are waiting for an explicit greeting (after a reset/error),
            # reject other inputs. Otherwise (fresh session), accept anything.
            if state.awaiting_greeting:
                if cleaned_text.casefold() not in GREETING_TOKENS:
                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(text="Please type 'Hi' to begin.")],
                    ), state_was_reset
                # Got the greeting, clear the flag and show main menu
                state.awaiting_greeting = False

            self._advance_step(state, ConversationStep.MAIN_MENU)
            greeting_text = flow_config["greeting"].format(salon_name=salon.name)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"{greeting_text}\n\nWhat would you like to do?",
                        buttons=[
                            {"label": "📅 Book", "callback": "action_book_new"},
                            {"label": "🔍 My Bookings", "callback": "action_manage_existing"},
                            {"label": "🔄 Start Over", "callback": "restart_flow"},
                        ],
                    ),
                ],
            ), state_was_reset

        if state.step == ConversationStep.MAIN_MENU:
            # Route based on user's choice
            if cleaned_text == "action_book_new":
                state.intent = UserIntent.NEW_BOOKING
                self._advance_step(state, ConversationStep.LANGUAGE)
                language_prompt = "Choose your language:"
                lang_buttons = [{"label": lang["label"], "callback": f"lang_{lang['id']}"} for lang in flow_config["languages"]]
                lang_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text=language_prompt,
                            buttons=lang_buttons,
                        ),
                    ],
                ), state_was_reset

            elif cleaned_text == "action_manage_existing":
                state.intent = UserIntent.MANAGE_BOOKING
                self._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)
                # Let conversation_service handle the lookup — we just signal the intent
                # Return a special FlowResult that tells the caller to look up appointments
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(text="__LOOKUP_APPOINTMENTS__"),
                    ],
                ), state_was_reset

            else:
                # Unrecognized input — show main menu again
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="Please choose an option:",
                            buttons=[
                                {"label": "📅 Book", "callback": "action_book_new"},
                                {"label": "🔍 My Bookings", "callback": "action_manage_existing"},
                            ],
                        ),
                    ],
                ), state_was_reset

        if state.step == ConversationStep.SELECT_APPOINTMENT:
            # Handle appointment selection when user has multiple appointments
            # User types a number (1, 2, 3, etc.) to select - no buttons needed
            
            # Try to parse as number
            try:
                selected_number = int(cleaned_text)
                
                # Get appointment IDs from state metadata
                appointment_ids = state.metadata.get("appointment_ids", []) if hasattr(state, 'metadata') and state.metadata else []
                
                if not appointment_ids:
                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(text="Appointment list not found. Please start over.")],
                        clear_state=True,
                    ), state_was_reset
                
                # Validate the number is within range
                if selected_number < 1 or selected_number > len(appointment_ids):
                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(
                            text=f"Please enter a number between 1 and {len(appointment_ids)}."
                        )],
                    ), state_was_reset
                
                # Get the selected appointment ID
                selected_apt_id = appointment_ids[selected_number - 1]
                
                # Load the appointment details
                from uuid import UUID
                appointment = await self.appointment_service.get_appointment(UUID(selected_apt_id))
                
                if not appointment:
                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(text="Could not find that appointment. Please try again.")],
                        clear_state=True,
                    ), state_was_reset
                
                # Update state with selected appointment details
                state.target_appointment_id = selected_apt_id
                state.slots.service_id = str(appointment.service_id) if appointment.service_id else None
                state.slots.service_name = appointment.service_name_snapshot
                
                # Convert to salon timezone for display
                local_time = appointment.appointment_at.astimezone(ZoneInfo(salon.timezone))
                state.slots.appointment_date = local_time.date()
                state.slots.appointment_time = local_time.time()
                
                date_str = local_time.strftime("%A, %d %b %Y")
                time_str = local_time.strftime("%I:%M %p")
                
                # Now show action menu for the selected appointment
                self._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)
                
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text=(
                                f"Selected appointment:\n\n"
                                f"📋 **{appointment.service_name_snapshot}**\n"
                                f"Ref: {appointment.booking_reference}\n"
                                f"📅 {date_str}\n"
                                f"⏰ {time_str}\n\n"
                                f"What would you like to do?"
                            ),
                            buttons=[
                                {"label": "🔄 Reschedule", "callback": "action_reschedule"},
                                {"label": "❌ Cancel", "callback": "action_cancel"},
                                {"label": "✅ Keep", "callback": "action_keep"},
                                {"label": "🔄 Start Over", "callback": "restart_flow"},
                            ],
                        )
                    ],
                ), state_was_reset
                
            except ValueError:
                # Not a number, check for special commands
                if cleaned_text in ["restart", "start over"]:
                    return FlowResult(
                        state=state,
                        clear_state=True,
                    ), state_was_reset
                
                # Invalid input
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="Please reply with a number (e.g., *1*, *2*, *3*) to select an appointment.")],
                ), state_was_reset

        if state.step == ConversationStep.MANAGE_APPOINTMENT_MENU:
            # Handle action buttons for the displayed appointment
            if cleaned_text == "action_reschedule":
                # Pre-fill date/time from the target appointment and jump to date selection
                self._advance_step(state, ConversationStep.APPOINTMENT_DATE)
                state.previous_step = ConversationStep.MANAGE_APPOINTMENT_MENU
                # Date and time are already pre-filled from the appointment
                today = datetime.now(ZoneInfo(salon.timezone)).date()
                date_buttons = []
                for i in range(7):
                    target_date = today + timedelta(days=i)
                    if i == 0:
                        label = "Today"
                    elif i == 1:
                        label = "Tomorrow"
                    else:
                        label = target_date.strftime("%a %d %b")
                    date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
                date_buttons.append({"label": "⬅️ Back", "callback": "go_back"})
                date_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="Let's pick a new date for your appointment.\n💡 Or type your preferred date (e.g. next Friday, 25/04/2026)",
                            buttons=date_buttons,
                        )
                    ],
                ), state_was_reset

            elif cleaned_text == "action_cancel":
                # Ask for cancellation confirmation
                self._advance_step(state, ConversationStep.CONFIRMATION)
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="Are you sure you want to cancel this appointment?",
                            buttons=[
                                {"label": "✅ Cancel", "callback": "confirm_yes"},
                                {"label": "❌ Keep", "callback": "confirm_no"},
                                {"label": "🔄 Start Over", "callback": "restart_flow"},
                            ],
                        )
                    ],
                ), state_was_reset

            elif cleaned_text == "action_keep":
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="Great! Your appointment is confirmed. Reply HI anytime if you need anything else.")],
                    clear_state=True,
                ), state_was_reset

            else:
                # Show action buttons again
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="What would you like to do?",
                            buttons=[
                                {"label": "🔄 Reschedule", "callback": "action_reschedule"},
                                {"label": "❌ Cancel", "callback": "action_cancel"},
                                {"label": "✅ Keep", "callback": "action_keep"},
                                {"label": "🔄 Start Over", "callback": "restart_flow"},
                            ],
                        )
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
                lang_buttons = [{"label": lang["label"], "callback": f"lang_{lang['id']}"} for lang in flow_config["languages"]]
                lang_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                result, _ = self._invalid_reply(state, "Please choose a valid language:", buttons=lang_buttons)
                return result, state_was_reset
            # Acknowledge language choice, then move to NAME collection
            state.slots.language = language["id"]
            self._advance_step(state, ConversationStep.CUSTOMER_NAME)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"Great! I'll continue in {language['label']}.\n\nFirst, may I have your name?"
                    )
                ]
            ), state_was_reset

        if state.step == ConversationStep.CUSTOMER_NAME:
            name = cleaned_text.strip()
            if not name:
                result, _ = self._invalid_reply(state, "Please provide your name so we can confirm the booking.")
                return result, state_was_reset
            
            state.slots.customer_name = name
            self._advance_step(state, ConversationStep.SERVICE)
            # Create buttons for services
            service_buttons = [{"label": svc.name, "callback": f"svc_{svc.id}"} for svc in services]
            service_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"Thanks, {name}! Which service do you need:",
                        buttons=service_buttons,
                    )
                ]
            ), state_was_reset

        if state.step == ConversationStep.SERVICE:
            # Handle button callback (svc_ID format)
            if cleaned_text.startswith("svc_"):
                service_id = cleaned_text.replace("svc_", "")
                service = self._find_service_by_id(services, service_id)
            else:
                service = await self._resolve_service(cleaned_text, services, state.slots.language)
            
            if not service:
                service_buttons = [{"label": svc.name, "callback": f"svc_{svc.id}"} for svc in services]
                service_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                result, _ = self._invalid_reply(state, "Please choose a valid service:", buttons=service_buttons)
                return result, state_was_reset
            state.slots.service_id = str(service.id)
            state.slots.service_name = service.name
            # Skip sample images, go directly to date selection with quick date buttons
            self._advance_step(state, ConversationStep.APPOINTMENT_DATE)
            today = datetime.now(ZoneInfo(salon.timezone)).date()
            # Show next 7 days for better user experience
            date_buttons = []
            for i in range(7):
                target_date = today + timedelta(days=i)
                if i == 0:
                    label = "Today"
                elif i == 1:
                    label = "Tomorrow"
                else:
                    label = target_date.strftime("%a %d %b")  # e.g., "Mon 14 Apr"
                date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
            date_buttons.append({"label": "⬅️ Back", "callback": "go_back"})
            date_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="Please choose your preferred appointment date:\n💡 Or type your preferred date (e.g. next Friday, 25/04/2026)",
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
            self._advance_step(state, ConversationStep.APPOINTMENT_DATE)
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
                # Pre-check: Reject time-like inputs during date selection
                # e.g., "5.30", "5:30", "5pm", "17:30" are clearly times, not dates
                time_like_pattern = re.match(
                    r'^\d{1,2}[\.:]\d{1,2}$|^\d{1,2}\s*(am|pm)$|^[\d]{1,2}:$|^\d{1,2}\.$',
                    cleaned_text.lower().strip()
                )
                if time_like_pattern:
                    appointment_date = None  # Force rejection - it's a time, not a date
                else:
                    appointment_date = await self._parse_date(cleaned_text, salon.timezone, state.slots.language)

            if not appointment_date:
                # First, check if this is a FAQ question (LLM fallback)
                faq_result = await self._handle_faq_fallback(cleaned_text, ConversationStep.APPOINTMENT_DATE, salon)
                if faq_result:
                    return faq_result, state_was_reset

                # Check if user typed a time-like input during date selection
                time_like_check = re.match(
                    r'^\d{1,2}[\.:]\d{1,2}$|^\d{1,2}\s*(am|pm)$|^[\d]{1,2}:$|^\d{1,2}\.$',
                    cleaned_text.lower().strip()
                )
                if time_like_check:
                    # User typed a time when we're asking for a date
                    result, _ = self._invalid_reply(state, (
                        f"That looks like a time (*{cleaned_text}*), but I need a *date* first.\n\n"
                        "Please pick a date (e.g. *tomorrow*, *next Friday*, *25 April*), then I'll ask for the time."
                    ))
                    result.messages[0].buttons = [
                        {"label": "🔄 Start Over", "callback": "restart_flow"}
                    ]
                    return result, state_was_reset

                # Graceful degradation: Show increasingly helpful examples
                # Note: _invalid_reply increments attempt_count, so check current value
                if state.attempt_count == 0:
                    error_msg = (
                        f"I couldn't understand '{cleaned_text}'.\n\n"
                        "Try typing:\n"
                        "• *25 April* or *next Friday*\n"
                        "• *25/04/2026* or *tomorrow*\n"
                        "• Or tap a button above 👆"
                    )
                elif state.attempt_count == 1:
                    error_msg = (
                        f"Still having trouble? Try a simpler format:\n"
                        "• *tomorrow*\n"
                        "• *next Monday*\n"
                        "• *25/04* (day/month)\n"
                        "• Or tap a button above 👆"
                    )
                else:
                    # 2+ strikes: Show Start Over option prominently
                    error_msg = (
                        f"I'm not sure about '{cleaned_text}'.\n\n"
                        "You can:\n"
                        "• Tap a date button above 👆\n"
                        "• Type *tomorrow* or *next Friday*\n"
                        "• Tap '🔄 Start Over' to restart"
                    )
                
                result, _ = self._invalid_reply(state, error_msg)
                result.messages[0].buttons = [
                    {"label": "🔄 Start Over", "callback": "restart_flow"}
                ]
                return result, state_was_reset
            
            # --- Validate 3-month advance booking limit HERE (not at confirmation) ---
            max_booking_date = datetime.now(ZoneInfo(salon.timezone)).date() + timedelta(days=90)
            if appointment_date > max_booking_date:
                # Date is too far in the future - show error and date buttons immediately
                today = datetime.now(ZoneInfo(salon.timezone)).date()
                date_buttons = []
                for i in range(7):
                    target_date = today + timedelta(days=i)
                    if i == 0:
                        label = "Today"
                    elif i == 1:
                        label = "Tomorrow"
                    else:
                        label = target_date.strftime("%a %d %b")
                    date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
                date_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(text="Appointments can only be booked up to 3 months in advance."),
                        OutboundInstruction(
                            text="Please choose a date within the next 7 days:\n💡 Or type your preferred date (e.g. next Friday, 25/04/2026)",
                            buttons=date_buttons,
                        ),
                    ],
                ), state_was_reset
            
            state.slots.appointment_date = appointment_date
            self._advance_step(state, ConversationStep.DATE_CONFIRMATION)
            
            # Format the date nicely for confirmation
            formatted_date = appointment_date.strftime("%A, %d %b %Y")
            
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"📅 You selected: *{formatted_date}*\n\nIs this date correct?",
                        buttons=[
                            {"label": "✅ Confirm", "callback": "date_confirm_yes"},
                            {"label": "❌ Change Date", "callback": "date_confirm_no"},
                        ],
                    )
                ],
            ), state_was_reset

        if state.step == ConversationStep.DATE_CONFIRMATION:
            # Handle confirmation response
            if cleaned_text == "date_confirm_yes":
                # User confirmed the date, proceed to time selection
                self._advance_step(state, ConversationStep.APPOINTMENT_TIME)
            elif cleaned_text == "date_confirm_no":
                # User wants to change date, go back to date selection
                state.step = ConversationStep.APPOINTMENT_DATE
                state.slots.appointment_date = None
                state.attempt_count = 0  # Reset for the new attempt
            else:
                # Check if user typed a date-like input (wants to change date)
                # Patterns: "17 may", "25/04", "next monday", "tomorrow", etc.
                date_like = False
                cleaned_lower = cleaned_text.lower().strip()
                # Check for common date patterns
                # Relative dates: today, tomorrow, next week, next monday, etc.
                relative_keywords = ['today', 'tomorrow', 'next ', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                if any(keyword in cleaned_lower for keyword in relative_keywords):
                    date_like = True
                # Date formats: "17 may", "25/04", "25-04", "april 17", etc.
                elif re.match(r'^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', cleaned_lower):
                    date_like = True  # e.g., "17 may", "25 apr"
                elif re.match(r'^\d{1,2}[/\-]\d{1,2}', cleaned_lower):
                    date_like = True  # e.g., "25/04", "17-05"
                elif re.match(r'^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}', cleaned_lower):
                    date_like = True  # e.g., "may 17", "april 25"
                
                if date_like:
                    # User provided a new date, parse it immediately and show confirmation
                    appointment_date = await self._parse_date(cleaned_text, salon.timezone, state.slots.language)
                    
                    if not appointment_date:
                        # Can't parse, go back to date selection
                        state.step = ConversationStep.APPOINTMENT_DATE
                        state.slots.appointment_date = None
                        return FlowResult(
                            state=state,
                            messages=[OutboundInstruction(
                                text="I couldn't understand that date. Please pick a date:",
                                buttons=[
                                    {"label": "🔄 Start Over", "callback": "restart_flow"}
                                ],
                            )],
                        ), state_was_reset
                    
                    # Validate 3-month advance booking limit
                    max_booking_date = datetime.now(ZoneInfo(salon.timezone)).date() + timedelta(days=90)
                    if appointment_date > max_booking_date:
                        state.step = ConversationStep.APPOINTMENT_DATE
                        state.slots.appointment_date = None
                        today = datetime.now(ZoneInfo(salon.timezone)).date()
                        date_buttons = []
                        for i in range(7):
                            target_date = today + timedelta(days=i)
                            if i == 0:
                                label = "Today"
                            elif i == 1:
                                label = "Tomorrow"
                            else:
                                label = target_date.strftime("%a %d %b")
                            date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
                        date_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                        return FlowResult(
                            state=state,
                            messages=[
                                OutboundInstruction(text="Appointments can only be booked up to 3 months in advance."),
                                OutboundInstruction(
                                    text="Please choose a date within the next 7 days:\n💡 Or type your preferred date (e.g. next Friday, 25/04/2026)",
                                    buttons=date_buttons,
                                ),
                            ],
                        ), state_was_reset
                    
                    # Save and show confirmation
                    state.slots.appointment_date = appointment_date
                    self._advance_step(state, ConversationStep.DATE_CONFIRMATION)
                    
                    formatted_date = appointment_date.strftime("%A, %d %b %Y")
                    return FlowResult(
                        state=state,
                        messages=[
                            OutboundInstruction(
                                text=f"📅 You selected: *{formatted_date}*\n\nIs this date correct?",
                                buttons=[
                                    {"label": "✅ Confirm", "callback": "date_confirm_yes"},
                                    {"label": "❌ Change Date", "callback": "date_confirm_no"},
                                ],
                            )
                        ],
                    ), state_was_reset
                else:
                    # Try to resolve as yes/no
                    confirmation = await self._resolve_yes_no(cleaned_text, state.slots.language)
                    if confirmation is True:
                        self._advance_step(state, ConversationStep.APPOINTMENT_TIME)
                    elif confirmation is False:
                        state.step = ConversationStep.APPOINTMENT_DATE
                        state.slots.appointment_date = None
                        state.attempt_count = 0
                        return FlowResult(
                            state=state,
                            messages=[
                                OutboundInstruction(
                                    text="No problem! Let's pick a different date.",
                                )
                            ],
                        ), state_was_reset
                    else:
                        return FlowResult(
                            state=state,
                            messages=[
                                OutboundInstruction(
                                    text="Please tap *Yes* to confirm or *No* to change the date.",
                                    buttons=[
                                        {"label": "✅ Confirm", "callback": "date_confirm_yes"},
                                        {"label": "❌ Change Date", "callback": "date_confirm_no"},
                                    ],
                                )
                            ],
                        ), state_was_reset

            # If we're proceeding to time selection, show time buttons
            if state.step == ConversationStep.APPOINTMENT_TIME:
                # Update previous step so "Back" returns to date confirmation
                state.previous_step = ConversationStep.DATE_CONFIRMATION
                
                # Generate hourly time slots based on salon business hours
                # Default to 9 AM - 6 PM if business hours not specified
                start_hour = 9
                end_hour = 18
                if hasattr(salon, 'business_hours') and salon.business_hours:
                    # Parse business hours if available (e.g., "09:00-18:00")
                    try:
                        hours_str = str(salon.business_hours)
                        if '-' in hours_str:
                            start_str, end_str = hours_str.split('-')
                            start_hour = int(start_str.split(':')[0])
                            end_hour = int(end_str.split(':')[0])
                    except (ValueError, AttributeError):
                        pass

                time_buttons = []
                for hour in range(start_hour, end_hour):
                    time_obj = time(hour=hour, minute=0)
                    label = time_obj.strftime("%I:%M %p").lstrip('0')  # e.g., "9:00 AM", "1:00 PM"
                    time_buttons.append({"label": label, "callback": f"time_{hour:02d}:00"})
                time_buttons.append({"label": "⬅️ Back", "callback": "go_back"})
                time_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})

                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="What time would you like to book?\n💡 Or type your preferred time (e.g. 4:30 PM, 17:30)",
                            buttons=time_buttons,
                        )
                    ],
                ), state_was_reset
            else:
                # User said No, return to date selection
                today = datetime.now(ZoneInfo(salon.timezone)).date()
                date_buttons = []
                for i in range(7):
                    target_date = today + timedelta(days=i)
                    if i == 0:
                        label = "Today"
                    elif i == 1:
                        label = "Tomorrow"
                    else:
                        label = target_date.strftime("%a %d %b")
                    date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
                date_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="Please choose your preferred appointment date:\n💡 Or type your preferred date (e.g. next Friday, 25/04/2026)",
                            buttons=date_buttons,
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

            # Define date-like patterns (used for pre-check AND error messages)
            date_like_patterns = [
                r'^(today|tomorrow|yesterday)$',
                r'^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)',
                r'^\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?$',  # "25/04", "25-04-2026"
                r'^(mon|tue|wed|thu|fri|sat|sun)\s+\d{1,2}',  # "mon 14", "friday 25"
                r'^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)',  # "25 april"
                r'^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}',  # "april 25"
            ]

            # Handle button callback (time_HH:MM format)
            if cleaned_text.startswith("time_"):
                time_str = cleaned_text.replace("time_", "")
                try:
                    appointment_time = time.fromisoformat(time_str)
                except ValueError:
                    appointment_time = None
            else:
                # Pre-check: Reject date-like inputs during time selection
                is_date_like = any(re.match(p, cleaned_text.lower().strip()) for p in date_like_patterns)
                if is_date_like:
                    appointment_time = None  # Force rejection - it's a date, not a time
                else:
                    appointment_time = await self._parse_time(
                        cleaned_text,
                        salon.timezone,
                        state.slots.appointment_date,
                        state.slots.language,
                    )
            
            if not appointment_time:
                # First, check if this is a FAQ question (LLM fallback)
                faq_result = await self._handle_faq_fallback(cleaned_text, ConversationStep.APPOINTMENT_TIME, salon)
                if faq_result:
                    return faq_result, state_was_reset

                # Check if user typed a date-like input during time selection
                date_like_check = any(re.match(p, cleaned_text.lower().strip()) for p in date_like_patterns)
                if date_like_check:
                    # User typed a date when we're asking for a time
                    result, _ = self._invalid_reply(state, (
                        f"That looks like a date (*{cleaned_text}*), but I need a *time*.\n\n"
                        "Please pick a time (e.g. *5pm*, *17:30*, *5.30*)."
                    ))
                    result.messages[0].buttons = [
                        {"label": "🔄 Start Over", "callback": "restart_flow"}
                    ]
                    return result, state_was_reset

                # Graceful degradation: Show increasingly helpful examples
                # Note: _invalid_reply increments attempt_count, so check current value
                if state.attempt_count == 0:
                    error_msg = (
                        f"I couldn't understand '{cleaned_text}'.\n\n"
                        "Try typing:\n"
                        "• *5:30 PM* or *17:30*\n"
                        "• *5.30* or *5pm*\n"
                        "• Or tap a button above 👆"
                    )
                elif state.attempt_count == 1:
                    error_msg = (
                        f"Still having trouble? Try a simpler format:\n"
                        "• *5pm*\n"
                        "• *17:30*\n"
                        "• *5.30*\n"
                        "• Or tap a button above 👆"
                    )
                else:
                    # 2+ strikes: Show Start Over option prominently
                    error_msg = (
                        f"I'm not sure about '{cleaned_text}'.\n\n"
                        "You can:\n"
                        "• Tap a time button above 👆\n"
                        "• Type *5pm* or *17:30*\n"
                        "• Tap '🔄 Start Over' to restart"
                    )
                
                result, _ = self._invalid_reply(state, error_msg)
                result.messages[0].buttons = [
                    {"label": "🔄 Start Over", "callback": "restart_flow"}
                ]
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

            # Save the time temporarily for confirmation
            state.slots.appointment_time = appointment_time
            self._advance_step(state, ConversationStep.TIME_CONFIRMATION)
            
            # Format the time nicely for confirmation
            formatted_time = appointment_time.strftime("%I:%M %p").lstrip('0')
            
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"⏰ You selected: *{formatted_time}*\n\nIs this time correct?",
                        buttons=[
                            {"label": "✅ Confirm", "callback": "time_confirm_yes"},
                            {"label": "❌ Change Time", "callback": "time_confirm_no"},
                        ],
                    )
                ],
            ), state_was_reset

        if state.step == ConversationStep.TIME_CONFIRMATION:
            # Handle confirmation response
            if cleaned_text == "time_confirm_yes":
                # For rescheduling: skip email step, go straight to update
                if state.intent == UserIntent.MANAGE_BOOKING and state.target_appointment_id:
                    self._advance_step(state, ConversationStep.COMPLETE)
                    state.is_complete = True
                    return FlowResult(state=state, should_update_appointment=True, clear_state=True), state_was_reset
                # Normal booking: proceed to email
                self._advance_step(state, ConversationStep.EMAIL)
            elif cleaned_text == "time_confirm_no":
                # User wants to change time, go back to time selection
                state.step = ConversationStep.APPOINTMENT_TIME
                state.slots.appointment_time = None
                state.attempt_count = 0
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text="No problem! Let's pick a different time.",
                        )
                    ],
                ), state_was_reset
            else:
                # Check if user typed a time-like input (wants to change time)
                # Patterns: "5.30", "5:30", "5 PM", "17:30", etc.
                time_like = False
                cleaned_lower = cleaned_text.lower().strip()
                # Check for time patterns
                if re.match(r'^\d{1,2}[\.:]\d{1,2}$', cleaned_lower):
                    time_like = True  # e.g., "5.30", "5:30"
                elif re.match(r'^\d{1,2}\s*(am|pm)$', cleaned_lower):
                    time_like = True  # e.g., "5 PM", "10 AM"
                elif re.match(r'^\d{1,2}$', cleaned_lower):
                    time_like = True  # e.g., "5", "10" (single hour)

                if time_like:
                    # User provided a new time, parse it immediately and show confirmation
                    appointment_time = await self._parse_time(
                        cleaned_text,
                        salon.timezone,
                        state.slots.appointment_date,
                        state.slots.language,
                    )
                    
                    if not appointment_time:
                        # Can't parse, go back to time selection
                        state.step = ConversationStep.APPOINTMENT_TIME
                        state.slots.appointment_time = None
                        return FlowResult(
                            state=state,
                            messages=[OutboundInstruction(
                                text="I couldn't understand that time. Please pick a time:",
                                buttons=[
                                    {"label": "🔄 Start Over", "callback": "restart_flow"}
                                ],
                            )],
                        ), state_was_reset
                    
                    # Check if time is in the past
                    current_time = datetime.now(ZoneInfo(salon.timezone))
                    appointment_at = datetime.combine(
                        state.slots.appointment_date,
                        appointment_time,
                        tzinfo=ZoneInfo(salon.timezone),
                    )
                    if appointment_at <= current_time:
                        state.step = ConversationStep.APPOINTMENT_TIME
                        state.slots.appointment_time = None
                        return FlowResult(
                            state=state,
                            messages=[OutboundInstruction(
                                text="That time is already in the past. Please choose a future time.",
                            )],
                        ), state_was_reset
                    
                    # Save and show confirmation
                    state.slots.appointment_time = appointment_time
                    self._advance_step(state, ConversationStep.TIME_CONFIRMATION)
                    
                    formatted_time = appointment_time.strftime("%I:%M %p").lstrip('0')
                    return FlowResult(
                        state=state,
                        messages=[
                            OutboundInstruction(
                                text=f"⏰ You selected: *{formatted_time}*\n\nIs this time correct?",
                                buttons=[
                                    {"label": "✅ Confirm", "callback": "time_confirm_yes"},
                                    {"label": "❌ Change Time", "callback": "time_confirm_no"},
                                ],
                            )
                        ],
                    ), state_was_reset
                else:
                    # Try to resolve as yes/no
                    try:
                        confirmation = await self._resolve_yes_no(cleaned_text, state.slots.language)
                    except Exception:
                        # LLM failed - don't crash, just ask user to use buttons
                        confirmation = None
                    
                    if confirmation is True:
                        self._advance_step(state, ConversationStep.EMAIL)
                    elif confirmation is False:
                        state.step = ConversationStep.APPOINTMENT_TIME
                        state.slots.appointment_time = None
                        state.attempt_count = 0
                        return FlowResult(
                            state=state,
                            messages=[
                                OutboundInstruction(
                                    text="No problem! Let's pick a different time.",
                                )
                            ],
                        ), state_was_reset
                    else:
                        return FlowResult(
                            state=state,
                            messages=[
                                OutboundInstruction(
                                    text="Please tap *Yes* to confirm or *No* to change the time.",
                                    buttons=[
                                        {"label": "✅ Confirm", "callback": "time_confirm_yes"},
                                        {"label": "❌ Change Time", "callback": "time_confirm_no"},
                                    ],
                                )
                            ],
                        ), state_was_reset

        if state.step == ConversationStep.EMAIL:
            # Handle email input
            email = cleaned_text.strip()
            # Basic email validation
            if not email or "@" not in email or "." not in email.split("@")[-1]:
                result, _ = self._invalid_reply(
                    state,
                    "Please provide a valid email address (e.g., name@example.com).",
                )
                result.messages[0].buttons = [
                    {"label": "🔄 Start Over", "callback": "restart_flow"}
                ]
                return result, state_was_reset
            
            state.slots.email = email
            self._advance_step(state, ConversationStep.CONFIRMATION)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=flow_config["confirmation_template"].format(
                            service=state.slots.service_name,
                            date=state.slots.appointment_date.strftime("%d %b %Y"),
                            time=state.slots.appointment_time.strftime("%I:%M %p"),
                        ),
                        buttons=[
                            {"label": "✅ YES", "callback": "confirm_yes"},
                            {"label": "❌ NO", "callback": "confirm_no"},
                            {"label": "✏️ Change Email", "callback": "change_email"},
                            {"label": "🔄 Start Over", "callback": "restart_flow"},
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
            elif cleaned_text == "change_email":
                # Go back to email step so user can provide a new email
                state.step = ConversationStep.EMAIL
                state.previous_step = ConversationStep.CONFIRMATION
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="No problem! Please provide your correct email address:")],
                ), state_was_reset
            else:
                confirmation = await self._resolve_yes_no(cleaned_text, state.slots.language)
            
            if confirmation is None:
                result, _ = self._invalid_reply(
                    state,
                    "Please tap YES or NO.",
                )
                return result, state_was_reset
            if not confirmation:
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="Appointment request cancelled. Reply HI whenever you want to start again.")],
                    clear_state=True,
                ), state_was_reset
            self._advance_step(state, ConversationStep.COMPLETE)
            state.is_complete = True
            # Check if this is a cancellation (manage intent) or a new booking
            if state.intent == UserIntent.MANAGE_BOOKING and state.target_appointment_id:
                return FlowResult(state=state, should_cancel_appointment=True, clear_state=True), state_was_reset
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
                return time(hour + 12, minutes)
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
                total = hour * 60 + 12 * 60 - minutes  # PM
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
                return time(hour + 12, 15)

        # Handle "half past X" → X:30
        rel_match = re.match(r'^half\s+past\s+(\d{1,2})$', cleaned)
        if rel_match:
            hour = int(rel_match.group(1))
            if 1 <= hour <= 12:
                return time(hour + 12, 30)

        # Pre-check 1: Dot-separated time formats (H.M, HH.MM, etc.)
        # e.g., "3.3" → 15:03, "5.30" → 17:30, "9.15" → 21:15
        # dateparser misinterprets these as dates (March 3rd), so we handle them first
        match = re.match(r'^(\d{1,2})\.(\d{1,2})$', cleaned)
        if match:
            hour, minute = int(match.group(1)), int(match.group(2))
            if 0 <= hour <= 23 and 0 <= minute <= 59:
                # In booking context, hours 1-12 = PM
                if 1 <= hour <= 12:
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

        # Pre-check 4: Single digit (1-12) - assume PM
        match = re.match(r'^(\d{1,2})$', cleaned)
        if match:
            hour = int(match.group(1))
            if 1 <= hour <= 12:
                return time(hour + 12, 0)
            elif 13 <= hour <= 23:
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
