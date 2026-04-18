"""Booking step handler — GREETING, MAIN_MENU, LANGUAGE, CUSTOMER_NAME,
SERVICE, SAMPLE_IMAGES, CONFIRMATION.

Receives the engine instance so all helpers are called directly — no logic
was moved out of engine.py.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence

from app.core.enums import ConversationStep, UserIntent
from app.db.models.salon import Salon, SalonService
from app.flows.definitions import GREETING_TOKENS
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState

if TYPE_CHECKING:
    from app.flows.engine import ConversationEngine


async def handle_booking(
    engine: "ConversationEngine",
    state: ConversationState,
    cleaned_text: str,
    salon: Salon,
    services: Sequence[SalonService],
    flow_config: dict[str, Any],
    state_was_reset: bool,
) -> tuple[FlowResult, bool] | None:
    """Handle GREETING, MAIN_MENU, LANGUAGE, CUSTOMER_NAME, SERVICE,
    SAMPLE_IMAGES, and CONFIRMATION steps.

    Returns a (FlowResult, state_was_reset) tuple when the step is handled,
    or None so the caller can try the next handler.
    """

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

        engine._advance_step(state, ConversationStep.MAIN_MENU)
        greeting_text = flow_config["greeting"].format(salon_name=salon.name)
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"{greeting_text}\n\nWhat would you like to do?",
                    buttons=[
                        {"label": "\U0001f4c5 Book", "callback": "action_book_new"},
                        {"label": "\U0001f50d My Bookings", "callback": "action_manage_existing"},
                        {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
                    ],
                ),
            ],
        ), state_was_reset

    if state.step == ConversationStep.MAIN_MENU:
        # Route based on user's choice
        if cleaned_text == "action_book_new":
            state.intent = UserIntent.NEW_BOOKING
            engine._advance_step(state, ConversationStep.LANGUAGE)
            language_prompt = "Choose your language:"
            lang_buttons = [
                {"label": lang["label"], "callback": f"lang_{lang['id']}"}
                for lang in flow_config["languages"]
            ]
            lang_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
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
            engine._advance_step(state, ConversationStep.LANGUAGE)
            language_prompt = "Choose your language:"
            lang_buttons = [
                {"label": lang["label"], "callback": f"lang_{lang['id']}"}
                for lang in flow_config["languages"]
            ]
            lang_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=language_prompt,
                        buttons=lang_buttons,
                    ),
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
                            {"label": "\U0001f4c5 Book", "callback": "action_book_new"},
                            {"label": "\U0001f50d My Bookings", "callback": "action_manage_existing"},
                        ],
                    ),
                ],
            ), state_was_reset

    if state.step == ConversationStep.LANGUAGE:
        language = await engine._resolve_choice(
            cleaned_text,
            flow_config["languages"],
            field_name="language",
            language_hint=None,
        )
        if not language:
            lang_buttons = [
                {"label": lang["label"], "callback": f"lang_{lang['id']}"}
                for lang in flow_config["languages"]
            ]
            lang_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
            result, _ = engine._invalid_reply(state, "Please choose a valid language:", buttons=lang_buttons)
            return result, state_was_reset
        # Acknowledge language choice, then move to next step based on intent
        state.slots.language = language["id"]
        
        if state.intent == UserIntent.MANAGE_BOOKING:
            engine._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(text="__LOOKUP_APPOINTMENTS__"),
                ],
            ), state_was_reset
            
        engine._advance_step(state, ConversationStep.CUSTOMER_NAME)
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"Great! I'll continue in {language['label']}.\n\nFirst, may I have your name?"
                )
            ],
        ), state_was_reset

    if state.step == ConversationStep.CUSTOMER_NAME:
        name = cleaned_text.strip()
        if not name:
            result, _ = engine._invalid_reply(
                state, "Please provide your name so we can confirm the booking."
            )
            return result, state_was_reset

        state.slots.customer_name = name
        engine._advance_step(state, ConversationStep.SERVICE)
        # Create buttons for services
        service_buttons = [{"label": svc.name, "callback": f"svc_{svc.id}"} for svc in services]
        service_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"Thanks, {name}! Which service do you need:",
                    buttons=service_buttons,
                )
            ],
        ), state_was_reset

    if state.step == ConversationStep.SERVICE:
        # Handle button callback (svc_ID format)
        if cleaned_text.startswith("svc_"):
            service_id = cleaned_text.replace("svc_", "")
            service = engine._find_service_by_id(services, service_id)
        else:
            service = await engine._resolve_service(cleaned_text, services, state.slots.language)

        if not service:
            service_buttons = [{"label": svc.name, "callback": f"svc_{svc.id}"} for svc in services]
            service_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
            result, _ = engine._invalid_reply(state, "Please choose a valid service:", buttons=service_buttons)
            return result, state_was_reset
        state.slots.service_id = str(service.id)
        state.slots.service_name = service.name
        # Skip sample images, go directly to date selection with quick date buttons
        engine._advance_step(state, ConversationStep.APPOINTMENT_DATE)
        date_buttons = engine._build_date_buttons(salon.timezone, include_back=True)
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text="Please choose your preferred appointment date:\n\U0001f4a1 Or type your preferred date (e.g. next Friday, 25/04/2026)",
                    buttons=date_buttons,
                )
            ],
        ), state_was_reset

    if state.step == ConversationStep.SAMPLE_IMAGES:
        wants_samples = await engine._resolve_yes_no(cleaned_text, state.slots.language)
        if wants_samples is None:
            result, _ = engine._invalid_reply(
                state,
                "Please reply YES if you want sample images, or NO to continue without them.",
            )
            return result, state_was_reset
        state.slots.wants_sample_images = wants_samples
        engine._advance_step(state, ConversationStep.APPOINTMENT_DATE)
        selected_service = engine._find_service_by_id(services, state.slots.service_id)
        instructions: list[OutboundInstruction] = []
        if wants_samples and selected_service and selected_service.sample_image_urls:
            instructions.append(
                OutboundInstruction(
                    text=f"Here are sample images for {selected_service.name}.",
                    media_urls=selected_service.sample_image_urls[: engine.settings.max_sample_images],
                )
            )
        elif wants_samples:
            instructions.append(
                OutboundInstruction(text="Sample images are not available right now for this service.")
            )
        instructions.append(OutboundInstruction(text="Please share your preferred appointment date."))
        return FlowResult(state=state, messages=instructions), state_was_reset

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
                messages=[OutboundInstruction(
                    text="No problem! Please provide your correct email address:",
                    buttons=[{"label": "⏭️ Skip", "callback": "action_skip_email"}],
                )],
            ), state_was_reset
        else:
            confirmation = await engine._resolve_yes_no(cleaned_text, state.slots.language)

        if confirmation is None:
            result, _ = engine._invalid_reply(
                state,
                "Please tap YES or NO.",
            )
            return result, state_was_reset
        if not confirmation:
            return FlowResult(
                state=state,
                messages=[OutboundInstruction(
                    text="Appointment request cancelled. Reply HI whenever you want to start again."
                )],
                clear_state=True,
            ), state_was_reset
        engine._advance_step(state, ConversationStep.COMPLETE)
        state.is_complete = True
        # Check if this is a cancellation (manage intent) or a new booking
        if state.intent == UserIntent.MANAGE_BOOKING and state.target_appointment_id:
            return FlowResult(state=state, should_cancel_appointment=True, clear_state=True), state_was_reset
        return FlowResult(state=state, should_create_appointment=True, clear_state=True), state_was_reset

    return None
