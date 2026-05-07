"""Management step handler — SELECT_APPOINTMENT, MANAGE_APPOINTMENT_MENU.

Receives the engine instance so all helpers (_advance_step, _build_date_buttons, etc.)
are called directly — no helper logic was moved out of engine.py.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Sequence
from uuid import UUID
from zoneinfo import ZoneInfo

from app.core.enums import ConversationStep
from app.db.models.salon import Salon, SalonService
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState

if TYPE_CHECKING:
    from app.flows.engine import ConversationEngine


async def handle_management(
    engine: "ConversationEngine",
    state: ConversationState,
    cleaned_text: str,
    salon: Salon,
    services: Sequence[SalonService],
    flow_config: dict[str, Any],
    state_was_reset: bool,
    customer: Any = None,  # noqa: ARG001 — accepted for handler-signature parity
) -> tuple[FlowResult, bool] | None:
    """Handle SELECT_APPOINTMENT and MANAGE_APPOINTMENT_MENU steps.

    Returns a (FlowResult, state_was_reset) tuple when the step is handled,
    or None so the caller can try the next handler.
    """

    if state.step == ConversationStep.SELECT_APPOINTMENT:
        # Handle appointment selection when user has multiple appointments
        # User types a number (1, 2, 3, etc.) to select - no buttons needed

        # Try to parse as number
        try:
            selected_number = int(cleaned_text)

            # Get appointment IDs from state metadata
            appointment_ids = (
                state.metadata.get("appointment_ids", [])
                if hasattr(state, "metadata") and state.metadata
                else []
            )

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
            appointment = await engine.appointment_service.get_appointment(UUID(selected_apt_id))

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
            engine._advance_step(state, ConversationStep.MANAGE_APPOINTMENT_MENU)

            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text=(
                            f"Selected appointment:\n\n"
                            f"\U0001f4cb **{appointment.service_name_snapshot}**\n"
                            f"Ref: {appointment.booking_reference}\n"
                            f"\U0001f4c5 {date_str}\n"
                            f"\u23f0 {time_str}\n\n"
                            f"What would you like to do?"
                        ),
                        buttons=[
                            {"label": "\U0001f504 Reschedule", "callback": "action_reschedule"},
                            {"label": "\u274c Cancel", "callback": "action_cancel"},
                            {"label": "\u2705 Keep", "callback": "action_keep"},
                            {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
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
                messages=[OutboundInstruction(
                    text="Please reply with a number (e.g., *1*, *2*, *3*) to select an appointment."
                )],
            ), state_was_reset

    if state.step == ConversationStep.MANAGE_APPOINTMENT_MENU:
        # Handle action buttons for the displayed appointment
        if cleaned_text == "action_reschedule":
            # Pre-fill date/time from the target appointment and jump to date selection
            engine._advance_step(state, ConversationStep.APPOINTMENT_DATE)
            state.previous_step = ConversationStep.MANAGE_APPOINTMENT_MENU
            # Date and time are already pre-filled from the appointment
            date_buttons, booked_text = engine._build_date_buttons(salon.timezone, include_back=True)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="Let's pick a new date for your appointment.\n\U0001f4a1 Or type your preferred date (e.g. next Friday, 25/04/2026)" + booked_text,
                        buttons=date_buttons,
                    )
                ],
            ), state_was_reset

        elif cleaned_text == "action_cancel":
            # Ask for cancellation confirmation
            engine._advance_step(state, ConversationStep.CONFIRMATION)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="Are you sure you want to cancel this appointment?",
                        buttons=[
                            {"label": "\u2705 Cancel", "callback": "confirm_yes"},
                            {"label": "\u274c Keep", "callback": "confirm_no"},
                            {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
                        ],
                    )
                ],
            ), state_was_reset

        elif cleaned_text == "action_keep":
            return FlowResult(
                state=state,
                messages=[OutboundInstruction(
                    text="Great! Your appointment is confirmed. Reply HI anytime if you need anything else."
                )],
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
                            {"label": "\U0001f504 Reschedule", "callback": "action_reschedule"},
                            {"label": "\u274c Cancel", "callback": "action_cancel"},
                            {"label": "\u2705 Keep", "callback": "action_keep"},
                            {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
                        ],
                    )
                ],
            ), state_was_reset

    return None
