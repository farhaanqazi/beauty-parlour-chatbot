"""Scheduling step handler — APPOINTMENT_DATE, DATE_CONFIRMATION,
APPOINTMENT_TIME, TIME_CONFIRMATION, EMAIL.

EMAIL is included here (not in booking.py) to preserve the original
fall-through behaviour: after TIME_CONFIRMATION advances state to EMAIL,
the code falls through to the EMAIL block within the same function call —
exactly as it did inside process_message.

Receives the engine instance so all helpers are called directly — no logic
was moved out of engine.py.
"""
from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING, Any, Sequence
from zoneinfo import ZoneInfo

from app.core.enums import ConversationStep, UserIntent
from app.db.models.salon import Salon, SalonService
from app.flows.slot_filling import format_service_label, next_booking_step
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState

if TYPE_CHECKING:
    from app.flows.engine import ConversationEngine


def _has_any_hour_slot(buttons: list[dict[str, str]]) -> bool:
    """True if the time-picker has at least one selectable hour (not just the
    Back/Start Over navigation rows).
    """
    return any(btn.get("callback", "").startswith("time_") for btn in buttons)


async def _rebuild_time_buttons_with_booked_hours(
    engine: "ConversationEngine",
    state: ConversationState,
    salon: Salon,
    services: Sequence[SalonService],
) -> tuple[list[dict[str, str]], str]:
    """Build the time-picker buttons for the user's current date+service selection,
    omitting any hours that conflict with existing CONFIRMED bookings (duration +
    15-min buffer overlap math).

    Returns ``(buttons, booked_text)`` — append ``booked_text`` to the prompt so
    users see which hours were filtered out. Falls back to a no-filtering render
    if the appointment_service query fails.
    """
    start_hour, end_hour = engine._get_business_hours(salon)
    selected = engine._find_service_by_id(services, state.slots.service_id)
    duration_minutes = (
        selected.duration_minutes
        if selected and selected.duration_minutes
        else 60
    )
    booked_hours: set[int] | None = None
    if engine.appointment_service is not None and state.slots.appointment_date:
        try:
            booked_hours = await engine.appointment_service.get_booked_hours_for_date(
                salon_id=salon.id,
                target_date=state.slots.appointment_date,
                timezone_name=salon.timezone,
                new_service_duration_minutes=duration_minutes,
            )
        except Exception:
            booked_hours = None

    if booked_hours is None:
        booked_hours = set()

    # Block past hours for today
    now = datetime.now(ZoneInfo(salon.timezone))
    if state.slots.appointment_date == now.date():
        # Block up to and including the current hour
        for hour in range(start_hour, now.hour + 1):
            booked_hours.add(hour)

    return engine._build_time_buttons(start_hour, end_hour, booked_hours=booked_hours)


def _advance_to_next_slot(
    engine: "ConversationEngine",
    state: ConversationState,
    services: Sequence[SalonService],
    came_from_update: bool,
    *,
    flow_config: dict[str, Any],
) -> FlowResult:
    """Advance the booking flow to the next missing slot.

    With email and phone intentionally removed from BOOKING_SLOTS, the only
    two outcomes here are:
    - `next_step == SERVICE`: returning customer used UPDATE_CONTACT or a
      newly-collected contact left service unset; jump to service selection.
    - `next_step is None`: every required slot is filled — render CONFIRMATION.
    """
    next_step = next_booking_step(state)

    if next_step == ConversationStep.SERVICE:
        engine._advance_step(state, ConversationStep.SERVICE)
        svc_buttons = [{"label": format_service_label(svc), "callback": f"svc_{svc.id}"} for svc in services]
        svc_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})
        prefix = "Updated! " if came_from_update else f"Got it{', ' + state.slots.customer_name if state.slots.customer_name else ''}! "
        return FlowResult(
            state=state,
            messages=[OutboundInstruction(
                text=f"{prefix}Which service do you need:",
                buttons=svc_buttons,
            )],
        )

    engine._advance_step(state, ConversationStep.CONFIRMATION)
    return FlowResult(
        state=state,
        messages=[OutboundInstruction(
            text=flow_config["confirmation_template"].format(
                service=state.slots.service_name,
                date=state.slots.appointment_date.strftime("%d %b %Y"),
                time=state.slots.appointment_time.strftime("%I:%M %p"),
            ),
            buttons=[
                {"label": "✅ YES", "callback": "confirm_yes"},
                {"label": "❌ NO", "callback": "confirm_no"},
                {"label": "✏️ Change Phone", "callback": "change_phone"},
                {"label": "\U0001f504 Start Over", "callback": "restart_flow"},
            ],
        )],
    )


def _prefer_business_hour_for_ambiguous_time(
    engine: "ConversationEngine",
    salon: Salon,
    raw_text: str,
    parsed_time: time | None,
) -> time | None:
    """Resolve inputs like "9", "9.15", or "5:30" to the in-hours meaning."""
    if parsed_time is None:
        return None

    cleaned = raw_text.strip().lower()
    if re.search(r"\b(am|pm)\b", cleaned):
        return parsed_time

    match = re.match(r"^(\d{1,2})(?:[.:](\d{1,2}))?$", cleaned)
    if not match:
        return parsed_time

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    if not (1 <= hour <= 12 and 0 <= minute <= 59):
        return parsed_time

    start_hour, end_hour = engine._get_business_hours(salon)

    def is_business_time(candidate: time) -> bool:
        return start_hour <= candidate.hour < end_hour

    if is_business_time(parsed_time):
        return parsed_time

    candidates = [time(hour, minute)]
    if hour < 12:
        candidates.append(time(hour + 12, minute))

    for candidate in candidates:
        if is_business_time(candidate):
            return candidate

    return parsed_time


async def handle_scheduling(
    engine: "ConversationEngine",
    state: ConversationState,
    cleaned_text: str,
    salon: Salon,
    services: Sequence[SalonService],
    flow_config: dict[str, Any],
    state_was_reset: bool,
    customer: Any = None,  # noqa: ARG001 — accepted for handler-signature parity
) -> tuple[FlowResult, bool] | None:
    """Handle APPOINTMENT_DATE, DATE_CONFIRMATION, APPOINTMENT_TIME,
    TIME_CONFIRMATION, and EMAIL steps.

    Returns a (FlowResult, state_was_reset) tuple when the step is handled,
    or None so the caller can try the next handler.
    """
    if cleaned_text.startswith("ignore_date_full"):
        return FlowResult(state=state, messages=[]), state_was_reset

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
                r'^\d{1,2}[.:]\d{1,2}$|^\d{1,2}\s*(am|pm)$|^\d{1,2}:$|^\d{1,2}\.$',
                cleaned_text.lower().strip(),
            )
            if time_like_pattern:
                appointment_date = None  # Force rejection - it's a time, not a date
            else:
                # --- Intercept standalone month names ---
                # e.g. "july", "june", "jan" — instead of guessing the day,
                # ask the user which date in that month they want.
                MONTH_MAP = {
                    "january": 1, "february": 2, "march": 3, "april": 4,
                    "may": 5, "june": 6, "july": 7, "august": 8,
                    "september": 9, "october": 10, "november": 11, "december": 12,
                    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
                    "jun": 6, "jul": 7, "aug": 8,
                    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
                }
                _cleaned_lower = cleaned_text.lower().strip()
                if _cleaned_lower in MONTH_MAP:
                    import calendar
                    month_num = MONTH_MAP[_cleaned_lower]
                    _now = datetime.now(ZoneInfo(salon.timezone))
                    _today = _now.date()
                    _max_date = _today + timedelta(days=90)

                    # Prefer current year; if that month has already passed, use next year
                    _year = _now.year
                    if month_num < _now.month:
                        _year += 1

                    _month_start = date(_year, month_num, 1)
                    _month_name_full = _month_start.strftime("%B %Y")

                    if _month_start > _max_date:
                        _date_buttons, _booked_text = await engine._rebuild_date_buttons_with_booked_dates(
                            salon, state=state, services=services
                        )
                        return FlowResult(
                            state=state,
                            messages=[
                                OutboundInstruction(
                                    text=f"Sorry, {_month_name_full} is more than 3 months away. "
                                         "Appointments can only be booked up to 3 months in advance."
                                ),
                                OutboundInstruction(
                                    text="Please choose from the next 7 days:\n\U0001f4a1 Or type a specific date (e.g. next Friday, 25/04/2026)" + _booked_text,
                                    buttons=_date_buttons,
                                ),
                            ],
                        ), state_was_reset

                    # Build per-day buttons for that month (future dates within 90 days)
                    _last_day = calendar.monthrange(_year, month_num)[1]
                    _month_end = date(_year, month_num, _last_day)
                    _effective_end = min(_month_end, _max_date)
                    _start_day = max(_month_start, _today)

                    _day_buttons: list[dict[str, str]] = []
                    _d = _start_day
                    while _d <= _effective_end:
                        _day_buttons.append({
                            "label": _d.strftime("%a %d"),
                            "callback": f"date_{_d.isoformat()}",
                        })
                        _d += timedelta(days=1)
                    _day_buttons.append({"label": "\U0001f504 Start Over", "callback": "restart_flow"})

                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(
                            text=f"\U0001f4c5 Which date in *{_month_name_full}* would you like to book?",
                            buttons=_day_buttons,
                        )],
                    ), state_was_reset

                appointment_date = await engine._parse_date(
                    cleaned_text, salon.timezone, state.slots.language
                )

        if not appointment_date:
            # First, check if this is a FAQ question (LLM fallback)
            faq_result = await engine._handle_faq_fallback(
                cleaned_text, ConversationStep.APPOINTMENT_DATE, salon
            )
            if faq_result:
                return faq_result, state_was_reset

            # Check if user typed a time-like input during date selection
            time_like_check = re.match(
                r'^\d{1,2}[.:]\d{1,2}$|^\d{1,2}\s*(am|pm)$|^\d{1,2}:$|^\d{1,2}\.$',
                cleaned_text.lower().strip(),
            )
            if time_like_check:
                # User typed a time when we're asking for a date
                result, _ = engine._invalid_reply(state, (
                    f"That looks like a time (*{cleaned_text}*), but I need a *date* first.\n\n"
                    "Please pick a date (e.g. *tomorrow*, *next Friday*, *25 April*), then I'll ask for the time."
                ))
                result.messages[0].buttons = [
                    {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
                ]
                return result, state_was_reset

            # Graceful degradation: Show increasingly helpful examples
            # Note: _invalid_reply increments attempt_count, so check current value
            if state.attempt_count == 0:
                error_msg = (
                    f"I couldn't understand '{cleaned_text}'.\n\n"
                    "Try typing:\n"
                    "\u2022 *25 April* or *next Friday*\n"
                    "\u2022 *25/04/2026* or *tomorrow*\n"
                    "\u2022 Or tap a button above \U0001f446"
                )
            elif state.attempt_count == 1:
                error_msg = (
                    "Still having trouble? Try a simpler format:\n"
                    "\u2022 *tomorrow*\n"
                    "\u2022 *next Monday*\n"
                    "\u2022 *25/04* (day/month)\n"
                    "\u2022 Or tap a button above \U0001f446"
                )
            else:
                # 2+ strikes: Show Start Over option prominently
                error_msg = (
                    f"I'm not sure about '{cleaned_text}'.\n\n"
                    "You can:\n"
                    "\u2022 Tap a date button above \U0001f446\n"
                    "\u2022 Type *tomorrow* or *next Friday*\n"
                    "\u2022 Tap '\U0001f504 Start Over' to restart"
                )

            result, _ = engine._invalid_reply(state, error_msg)
            result.messages[0].buttons = [
                {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
            ]
            return result, state_was_reset

        # --- Validate 3-month advance booking limit HERE (not at confirmation) ---
        max_booking_date = datetime.now(ZoneInfo(salon.timezone)).date() + timedelta(days=90)
        if appointment_date > max_booking_date:
            # Date is too far in the future - show error and date buttons immediately
            date_buttons, booked_text = await engine._rebuild_date_buttons_with_booked_dates(salon, state=state, services=services)
            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(text="Appointments can only be booked up to 3 months in advance."),
                    OutboundInstruction(
                        text="Please choose a date within the next 7 days:\n\U0001f4a1 Or type your preferred date (e.g. next Friday, 25/04/2026)" + booked_text,
                        buttons=date_buttons,
                    ),
                ],
            ), state_was_reset

        # --- Check if fully booked before asking for confirmation ---
        original_date = state.slots.appointment_date
        state.slots.appointment_date = appointment_date
        time_buttons, _ = await _rebuild_time_buttons_with_booked_hours(engine, state, salon, services)
        state.slots.appointment_date = original_date

        if not _has_any_hour_slot(time_buttons):
            date_buttons, date_booked_text = await engine._rebuild_date_buttons_with_booked_dates(salon, state=state, services=services)
            formatted_date = appointment_date.strftime("%A, %d %b %Y")
            return FlowResult(
                state=state,
                messages=[OutboundInstruction(
                    text=f"Sorry — {formatted_date} is fully booked. Please pick another date:" + date_booked_text,
                    buttons=date_buttons,
                )],
            ), state_was_reset

        state.slots.appointment_date = appointment_date
        engine._advance_step(state, ConversationStep.DATE_CONFIRMATION)

        # Format the date nicely for confirmation
        formatted_date = appointment_date.strftime("%A, %d %b %Y")

        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"\U0001f4c5 You selected: *{formatted_date}*\n\nIs this date correct?",
                    buttons=[
                        {"label": "\u2705 Confirm", "callback": "date_confirm_yes"},
                        {"label": "\u274c Change Date", "callback": "date_confirm_no"},
                    ],
                )
            ],
        ), state_was_reset

    if state.step == ConversationStep.DATE_CONFIRMATION:
        # Handle confirmation response
        if cleaned_text == "date_confirm_yes":
            # User confirmed the date, proceed to time selection
            engine._advance_step(state, ConversationStep.APPOINTMENT_TIME)
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
            relative_keywords = [
                "today", "tomorrow", "next ", "monday", "tuesday", "wednesday",
                "thursday", "friday", "saturday", "sunday",
            ]
            # Full/abbreviated month names (standalone, e.g. "july", "jan")
            month_names = {
                "january", "february", "march", "april", "may", "june",
                "july", "august", "september", "october", "november", "december",
                "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
            }
            if any(keyword in cleaned_lower for keyword in relative_keywords):
                date_like = True
            # Standalone month name — treat as a date, not as yes/no
            elif cleaned_lower in month_names:
                date_like = True
            # Date formats: "17 may", "25/04", "25-04", "april 17", etc.
            elif re.match(r'^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', cleaned_lower):
                date_like = True  # e.g., "17 may", "25 apr"
            elif re.match(r'^\d{1,2}[/\-]\d{1,2}', cleaned_lower):
                date_like = True  # e.g., "25/04", "17-05"
            elif re.match(r'^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}', cleaned_lower):
                date_like = True  # e.g., "may 17", "april 25"
            # Month name followed by a year: "july 2026"
            elif re.match(r'^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$', cleaned_lower):
                date_like = True  # e.g., "july 2026"

            if date_like:
                # User provided a new date, parse it immediately and show confirmation
                appointment_date = await engine._parse_date(
                    cleaned_text, salon.timezone, state.slots.language
                )

                if not appointment_date:
                    # Can't parse, go back to date selection
                    state.step = ConversationStep.APPOINTMENT_DATE
                    state.slots.appointment_date = None
                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(
                            text="I couldn't understand that date. Please pick a date:",
                            buttons=[
                                {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
                            ],
                        )],
                    ), state_was_reset

                # Validate 3-month advance booking limit
                max_booking_date = datetime.now(ZoneInfo(salon.timezone)).date() + timedelta(days=90)
                if appointment_date > max_booking_date:
                    state.step = ConversationStep.APPOINTMENT_DATE
                    state.slots.appointment_date = None
                    date_buttons, booked_text = await engine._rebuild_date_buttons_with_booked_dates(salon, state=state, services=services)
                    return FlowResult(
                        state=state,
                        messages=[
                            OutboundInstruction(text="Appointments can only be booked up to 3 months in advance."),
                            OutboundInstruction(
                                text="Please choose a date within the next 7 days:\n\U0001f4a1 Or type your preferred date (e.g. next Friday, 25/04/2026)" + booked_text,
                                buttons=date_buttons,
                            ),
                        ],
                    ), state_was_reset

                # --- Check if fully booked before asking for confirmation ---
                original_date = state.slots.appointment_date
                state.slots.appointment_date = appointment_date
                time_buttons, _ = await _rebuild_time_buttons_with_booked_hours(engine, state, salon, services)
                state.slots.appointment_date = original_date

                if not _has_any_hour_slot(time_buttons):
                    state.step = ConversationStep.APPOINTMENT_DATE
                    state.slots.appointment_date = None
                    date_buttons, date_booked_text = await engine._rebuild_date_buttons_with_booked_dates(salon, state=state, services=services)
                    formatted_date = appointment_date.strftime("%A, %d %b %Y")
                    return FlowResult(
                        state=state,
                        messages=[OutboundInstruction(
                            text=f"Sorry — {formatted_date} is fully booked. Please pick another date:" + date_booked_text,
                            buttons=date_buttons,
                        )],
                    ), state_was_reset

                # Save and show confirmation
                state.slots.appointment_date = appointment_date
                engine._advance_step(state, ConversationStep.DATE_CONFIRMATION)

                formatted_date = appointment_date.strftime("%A, %d %b %Y")
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text=f"\U0001f4c5 You selected: *{formatted_date}*\n\nIs this date correct?",
                            buttons=[
                                {"label": "\u2705 Confirm", "callback": "date_confirm_yes"},
                                {"label": "\u274c Change Date", "callback": "date_confirm_no"},
                            ],
                        )
                    ],
                ), state_was_reset
            else:
                # Try to resolve as yes/no
                confirmation = await engine._resolve_yes_no(cleaned_text, state.slots.language)
                if confirmation is True:
                    engine._advance_step(state, ConversationStep.APPOINTMENT_TIME)
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
                                    {"label": "\u2705 Confirm", "callback": "date_confirm_yes"},
                                    {"label": "\u274c Change Date", "callback": "date_confirm_no"},
                                ],
                            )
                        ],
                    ), state_was_reset

        # If we're proceeding to time selection, show time buttons
        if state.step == ConversationStep.APPOINTMENT_TIME:
            # Update previous step so "Back" returns to date confirmation
            state.previous_step = ConversationStep.DATE_CONFIRMATION

            time_buttons, booked_text = await _rebuild_time_buttons_with_booked_hours(
                engine, state, salon, services
            )
            if not _has_any_hour_slot(time_buttons):
                # Every hour booked — bounce back to date selection.
                state.step = ConversationStep.APPOINTMENT_DATE
                state.slots.appointment_date = None
                date_buttons, date_booked_text = await engine._rebuild_date_buttons_with_booked_dates(salon, state=state, services=services)
                return FlowResult(
                    state=state,
                    messages=[OutboundInstruction(
                        text="Sorry — that day is fully booked. Please pick another date:" + date_booked_text,
                        buttons=date_buttons,
                    )],
                ), state_was_reset

            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="What time would you like to book?\n\U0001f4a1 Or type your preferred time (e.g. 4:30 PM, 17:30)" + booked_text,
                        buttons=time_buttons,
                    )
                ],
            ), state_was_reset
        else:
            # User said No, return to date selection
            date_buttons, booked_text = await engine._rebuild_date_buttons_with_booked_dates(salon, state=state, services=services)

            return FlowResult(
                state=state,
                messages=[
                    OutboundInstruction(
                        text="Please choose your preferred appointment date:\n\U0001f4a1 Or type your preferred date (e.g. next Friday, 25/04/2026)" + booked_text,
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
                appointment_time = await engine._parse_time(
                    cleaned_text,
                    salon.timezone,
                    state.slots.appointment_date,
                    state.slots.language,
                )
                appointment_time = _prefer_business_hour_for_ambiguous_time(
                    engine, salon, cleaned_text, appointment_time
                )

        if not appointment_time:
            # First, check if this is a FAQ question (LLM fallback)
            faq_result = await engine._handle_faq_fallback(
                cleaned_text, ConversationStep.APPOINTMENT_TIME, salon
            )
            if faq_result:
                return faq_result, state_was_reset

            # Check if user typed a date-like input during time selection
            date_like_check = any(re.match(p, cleaned_text.lower().strip()) for p in date_like_patterns)
            if date_like_check:
                # User typed a date when we're asking for a time
                result, _ = engine._invalid_reply(state, (
                    f"That looks like a date (*{cleaned_text}*), but I need a *time*.\n\n"
                    "Please pick a time (e.g. *5pm*, *17:30*, *5.30*)."
                ))
                result.messages[0].buttons = [
                    {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
                ]
                return result, state_was_reset

            # Graceful degradation: Show increasingly helpful examples
            # Note: _invalid_reply increments attempt_count, so check current value
            if state.attempt_count == 0:
                error_msg = (
                    f"I couldn't understand '{cleaned_text}'.\n\n"
                    "Try typing:\n"
                    "\u2022 *5:30 PM* or *17:30*\n"
                    "\u2022 *5.30* or *5pm*\n"
                    "\u2022 Or tap a button above \U0001f446"
                )
            elif state.attempt_count == 1:
                error_msg = (
                    "Still having trouble? Try a simpler format:\n"
                    "\u2022 *5pm*\n"
                    "\u2022 *17:30*\n"
                    "\u2022 *5.30*\n"
                    "\u2022 Or tap a button above \U0001f446"
                )
            else:
                # 2+ strikes: Show Start Over option prominently
                error_msg = (
                    f"I'm not sure about '{cleaned_text}'.\n\n"
                    "You can:\n"
                    "\u2022 Tap a time button above \U0001f446\n"
                    "\u2022 Type *5pm* or *17:30*\n"
                    "\u2022 Tap '\U0001f504 Start Over' to restart"
                )

            result, _ = engine._invalid_reply(state, error_msg)
            result.messages[0].buttons = [
                {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
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
            result, _ = engine._invalid_reply(
                state,
                "That time is already in the past. Please choose a future time.",
            )
            return result, state_was_reset

        # Save the time temporarily for confirmation
        state.slots.appointment_time = appointment_time
        engine._advance_step(state, ConversationStep.TIME_CONFIRMATION)

        # Format the time nicely for confirmation
        formatted_time = appointment_time.strftime("%I:%M %p").lstrip("0")

        return FlowResult(
            state=state,
            messages=[
                OutboundInstruction(
                    text=f"\u23f0 You selected: *{formatted_time}*\n\nIs this time correct?",
                    buttons=[
                        {"label": "\u2705 Confirm", "callback": "time_confirm_yes"},
                        {"label": "\u274c Change Time", "callback": "time_confirm_no"},
                    ],
                )
            ],
        ), state_was_reset

    if state.step == ConversationStep.TIME_CONFIRMATION:
        # Handle confirmation response
        if cleaned_text == "time_confirm_yes":
            # For rescheduling: skip email step, go straight to update
            if state.intent == UserIntent.MANAGE_BOOKING and state.target_appointment_id:
                engine._advance_step(state, ConversationStep.COMPLETE)
                state.is_complete = True
                return FlowResult(state=state, should_update_appointment=True, clear_state=True), state_was_reset
            # Normal booking: hand off to slot-filling (will skip email/phone if already on file)
            return _advance_to_next_slot(
                engine, state, services, came_from_update=False, flow_config=flow_config
            ), state_was_reset
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
            if re.match(r'^\d{1,2}[.:]\d{1,2}$', cleaned_lower):
                time_like = True  # e.g., "5.30", "5:30"
            elif re.match(r'^\d{1,2}\s*(am|pm)$', cleaned_lower):
                time_like = True  # e.g., "5 PM", "10 AM"
            elif re.match(r'^\d{1,2}$', cleaned_lower):
                time_like = True  # e.g., "5", "10" (single hour)

            if time_like:
                # User provided a new time, parse it immediately and show confirmation
                appointment_time = await engine._parse_time(
                    cleaned_text,
                    salon.timezone,
                    state.slots.appointment_date,
                    state.slots.language,
                )
                appointment_time = _prefer_business_hour_for_ambiguous_time(
                    engine, salon, cleaned_text, appointment_time
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
                                {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
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
                engine._advance_step(state, ConversationStep.TIME_CONFIRMATION)

                formatted_time = appointment_time.strftime("%I:%M %p").lstrip("0")
                return FlowResult(
                    state=state,
                    messages=[
                        OutboundInstruction(
                            text=f"\u23f0 You selected: *{formatted_time}*\n\nIs this time correct?",
                            buttons=[
                                {"label": "\u2705 Confirm", "callback": "time_confirm_yes"},
                                {"label": "\u274c Change Time", "callback": "time_confirm_no"},
                            ],
                        )
                    ],
                ), state_was_reset
            else:
                # Try to resolve as yes/no
                try:
                    confirmation = await engine._resolve_yes_no(cleaned_text, state.slots.language)
                except Exception:
                    # LLM failed - don't crash, just ask user to use buttons
                    confirmation = None

                if confirmation is True:
                    return _advance_to_next_slot(
                        engine, state, services, came_from_update=False, flow_config=flow_config
                    ), state_was_reset
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
                                    {"label": "\u2705 Confirm", "callback": "time_confirm_yes"},
                                    {"label": "\u274c Change Time", "callback": "time_confirm_no"},
                                ],
                            )
                        ],
                    ), state_was_reset

    # --- EMAIL ---
    if state.step == ConversationStep.EMAIL:
        came_from_update = state.previous_step == ConversationStep.UPDATE_CONTACT

        # User might have clicked "Skip" button or typed "skip"
        if cleaned_text.lower() in {"skip", "action_skip_email", "skip email"}:
            state.slots.email = None
            return _advance_to_next_slot(engine, state, services, came_from_update, flow_config=flow_config), state_was_reset

        # Handle email input
        email = cleaned_text.strip()
        # Basic email validation
        if not email or "@" not in email or "." not in email.split("@")[-1]:
            result, _ = engine._invalid_reply(
                state,
                "Please provide a valid email address (e.g., name@example.com).",
            )
            result.messages[0].buttons = [
                {"label": "⏭️ Skip", "callback": "action_skip_email"},
                {"label": "\U0001f504 Start Over", "callback": "restart_flow"}
            ]
            return result, state_was_reset

        state.slots.email = email
        return _advance_to_next_slot(engine, state, services, came_from_update, flow_config=flow_config), state_was_reset

    # --- PHONE NUMBER ---
    if state.step == ConversationStep.PHONE_NUMBER:
        came_from_update = state.previous_step == ConversationStep.UPDATE_CONTACT

        # Allow skipping
        if cleaned_text.lower() in {"skip", "action_skip_phone", "skip phone"}:
            state.slots.phone_number = None
            return _advance_to_next_slot(
                engine, state, services, came_from_update, flow_config=flow_config
            ), state_was_reset

        # Strip everything that is not a digit so users can type +91 98765 43210, etc.
        digits_only = re.sub(r"\D", "", cleaned_text.strip())

        if len(digits_only) < 10:
            result, _ = engine._invalid_reply(
                state,
                "Please enter a valid phone number with at least 10 digits (e.g., 9876543210).",
            )
            result.messages[0].buttons = [
                {"label": "⏭️ Skip", "callback": "action_skip_phone"},
                {"label": "🔄 Start Over", "callback": "restart_flow"},
            ]
            return result, state_was_reset

        # Store the cleaned digit string (preserve leading country code if present)
        state.slots.phone_number = digits_only
        return _advance_to_next_slot(
            engine, state, services, came_from_update, flow_config=flow_config
        ), state_was_reset

    return None
