"""Booking step handler — GREETING, MAIN_MENU, LANGUAGE, CUSTOMER_NAME,
SERVICE, SAMPLE_IMAGES, CONFIRMATION.

Receives the engine instance so all helpers are called directly — no logic
was moved out of engine.py.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence

from app.core.enums import ConversationStep, UserIntent
from app.db.models.customer import Customer
from app.db.models.salon import Salon, SalonService
from app.flows.definitions import GREETING_TOKENS
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState

if TYPE_CHECKING:
    from app.flows.engine import ConversationEngine


def _service_buttons(services: Sequence[SalonService]) -> list[dict[str, str]]:
    buttons: list[dict[str, str]] = [
        {"label": svc.name, "callback": f"svc_{svc.id}"} for svc in services
    ]
    buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
    return buttons


def _advance_to_service(
    engine: "ConversationEngine",
    state: ConversationState,
    services: Sequence[SalonService],
    intro_text: str,
) -> tuple[FlowResult, bool]:
    """Skip directly to SERVICE selection (used when name/phone/email are already on file)."""
    engine._advance_step(state, ConversationStep.SERVICE)
    return FlowResult(
        state=state,
        messages=[
            OutboundInstruction(text=intro_text, buttons=_service_buttons(services)),
        ],
    ), False


def _handle_returning_customer(
    engine: "ConversationEngine",
    state: ConversationState,
    customer: Customer | None,
    services: Sequence[SalonService],
    state_was_reset: bool,
    intro_prefix: str = "",
) -> tuple[FlowResult, bool]:
    """Decide what to ask a returning customer based on what's already on file.

    Order of asks: name → phone → email → (skip to service if all known).
    Pre-fills slots so downstream steps don't re-ask for the same data.
    """
    name = (customer.display_name or "").strip() if customer else ""
    phone = (customer.phone_number or "").strip() if customer else ""
    email = (customer.email or "").strip() if customer else ""

    if name:
        state.slots.customer_name = name
    if phone:
        state.slots.phone_number = phone
    if email:
        state.slots.email = email

    if not name:
        engine._advance_step(state, ConversationStep.CUSTOMER_NAME)
        return FlowResult(
            state=state,
            messages=[OutboundInstruction(text=f"{intro_prefix}First, may I have your name?")],
        ), state_was_reset

    if not phone:
        engine._advance_step(state, ConversationStep.PHONE_NUMBER)
        return FlowResult(
            state=state,
            messages=[OutboundInstruction(
                text=f"{intro_prefix}Welcome back, {name}! We don't have your phone number on file — please share it (at least 10 digits):",
                buttons=[{"label": "⏭️ Skip", "callback": "action_skip_phone"}],
            )],
        ), state_was_reset

    if not email:
        engine._advance_step(state, ConversationStep.EMAIL)
        return FlowResult(
            state=state,
            messages=[OutboundInstruction(
                text=f"{intro_prefix}Welcome back, {name}! We don't have your email on file — please share it:",
                buttons=[{"label": "⏭️ Skip", "callback": "action_skip_email"}],
            )],
        ), state_was_reset

    # All three on file: show "Continue / Update phone / Update email" choice
    engine._advance_step(state, ConversationStep.UPDATE_CONTACT)
    return FlowResult(
        state=state,
        messages=[OutboundInstruction(
            text=(
                f"{intro_prefix}Welcome back, {name}! \U0001f44b\n\n"
                f"\U0001f4cb On file:\n"
                f"\U0001f4de {phone}\n"
                f"\U0001f4e7 {email}\n\n"
                f"Continue with these or update?"
            ),
            buttons=[
                {"label": "✅ Continue Booking", "callback": "action_continue_with_details"},
                {"label": "✏️ Update Phone", "callback": "action_update_phone"},
                {"label": "✏️ Update Email", "callback": "action_update_email"},
                {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
            ],
        )],
    ), state_was_reset


def _language_buttons(flow_config: dict[str, Any]) -> list[dict[str, str]]:
    buttons = [
        {"label": lang["label"], "callback": f"lang_{lang['id']}"}
        for lang in flow_config["languages"]
    ]
    buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
    return buttons


def _main_menu_buttons() -> list[dict[str, str]]:
    return [
        {"label": "\U0001f4c5 Book", "callback": "action_book_new"},
        {"label": "\U0001f50d My Bookings", "callback": "action_manage_existing"},
        {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
    ]


async def handle_booking(
    engine: "ConversationEngine",
    state: ConversationState,
    cleaned_text: str,
    salon: Salon,
    services: Sequence[SalonService],
    flow_config: dict[str, Any],
    state_was_reset: bool,
    customer: Customer | None = None,
) -> tuple[FlowResult, bool] | None:
    """Handle GREETING, MAIN_MENU, LANGUAGE, CUSTOMER_NAME, SERVICE,
    SAMPLE_IMAGES, and CONFIRMATION steps.

    Returns a (FlowResult, state_was_reset) tuple when the step is handled,
    or None so the caller can try the next handler.
    """

    if state.step == ConversationStep.GREETING:
        if state.slots.language and cleaned_text == "action_book_new":
            state.intent = UserIntent.NEW_BOOKING
            return _handle_returning_customer(engine, state, customer, services, state_was_reset)

        if state.slots.language and cleaned_text == "action_manage_existing":
            state.intent = UserIntent.MANAGE_BOOKING
            engine._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(text="__LOOKUP_APPOINTMENTS__"),
                ],
            ), state_was_reset

        # STRICT MODE: If we are waiting for an explicit greeting (after a reset/error),
        # reject other inputs. Otherwise (fresh session), accept anything.
        if state.awaiting_greeting:
            if cleaned_text.casefold() not in GREETING_TOKENS:
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(text="Please type 'Hi' to begin.")],
                ), state_was_reset
            # Got the greeting, clear the flag and show language options
            state.awaiting_greeting = False

        # Returning customer: personalize the greeting and, if their preferred
        # language is on file, skip the language picker entirely. New customers
        # (no display_name) fall through to the standard salon greeting below.
        returning_name = (customer.display_name or "").strip() if customer else ""
        preferred_language = (customer.preferred_language or "").strip() if customer else ""

        if returning_name and preferred_language:
            state.slots.language = preferred_language
            engine._advance_step(state, ConversationStep.MAIN_MENU)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"Welcome back, {returning_name}! \U0001f44b\n\nWhat would you like to do?",
                        buttons=_main_menu_buttons(),
                    ),
                ],
            ), state_was_reset

        if returning_name:
            engine._advance_step(state, ConversationStep.LANGUAGE)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=f"Welcome back, {returning_name}! \U0001f44b\n\nChoose your language:",
                        buttons=_language_buttons(flow_config),
                    ),
                ],
            ), state_was_reset

        engine._advance_step(state, ConversationStep.LANGUAGE)
        greeting_text = flow_config["greeting"].format(salon_name=salon.name)
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"{greeting_text}\n\nChoose your language:",
                    buttons=_language_buttons(flow_config),
                ),
            ],
        ), state_was_reset

    if state.step == ConversationStep.MAIN_MENU:
        # Route based on user's choice
        if cleaned_text == "action_book_new":
            state.intent = UserIntent.NEW_BOOKING
            return _handle_returning_customer(engine, state, customer, services, state_was_reset)

        elif cleaned_text == "action_manage_existing":
            state.intent = UserIntent.MANAGE_BOOKING
            engine._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)
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
                        buttons=_main_menu_buttons(),
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
            result, _ = engine._invalid_reply(
                state,
                "Please choose a valid language:",
                buttons=_language_buttons(flow_config),
            )
            return result, state_was_reset

        state.slots.language = language["id"]
        if state.previous_step == ConversationStep.MAIN_MENU:
            if state.intent == UserIntent.MANAGE_BOOKING:
                engine._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(text="__LOOKUP_APPOINTMENTS__"),
                    ],
                ), state_was_reset

            return _handle_returning_customer(
                engine, state, customer, services, state_was_reset,
                intro_prefix=f"Great! I'll continue in {language['label']}.\n\n",
            )

        engine._advance_step(state, ConversationStep.MAIN_MENU)
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"Great! I'll continue in {language['label']}.\n\nWhat would you like to do?",
                    buttons=_main_menu_buttons(),
                )
            ],
        ), state_was_reset

    if state.step == ConversationStep.UPDATE_CONTACT:
        if cleaned_text == "action_continue_with_details":
            return _advance_to_service(
                engine, state, services,
                f"Great, {state.slots.customer_name}! Which service do you need:",
            )
        if cleaned_text == "action_update_phone":
            state.previous_step = ConversationStep.UPDATE_CONTACT
            engine._advance_step(state, ConversationStep.PHONE_NUMBER)
            return FlowResult(
                state=state,
                messages=[OutboundInstruction(
                    text="Please enter the new phone number (at least 10 digits):",
                    buttons=[{"label": "⏭️ Skip", "callback": "action_skip_phone"}],
                )],
            ), state_was_reset
        if cleaned_text == "action_update_email":
            state.previous_step = ConversationStep.UPDATE_CONTACT
            engine._advance_step(state, ConversationStep.EMAIL)
            return FlowResult(
                state=state,
                messages=[OutboundInstruction(
                    text="Please enter the new email address:",
                    buttons=[{"label": "⏭️ Skip", "callback": "action_skip_email"}],
                )],
            ), state_was_reset
        # Anything else: re-show the choice
        return _handle_returning_customer(engine, state, customer, services, state_was_reset)

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
        date_buttons, booked_text = engine._build_date_buttons(salon.timezone, include_back=True)
        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text="Please choose your preferred appointment date:\n\U0001f4a1 Or type your preferred date (e.g. next Friday, 25/04/2026)" + booked_text,
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
        elif cleaned_text == "change_phone":
            # Go back to phone number step
            state.step = ConversationStep.PHONE_NUMBER
            state.previous_step = ConversationStep.CONFIRMATION
            return FlowResult(
                state=state,
                messages=[OutboundInstruction(
                    text="Please enter the correct phone number (at least 10 digits):",
                    buttons=[{"label": "⏭️ Skip", "callback": "action_skip_phone"}],
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
