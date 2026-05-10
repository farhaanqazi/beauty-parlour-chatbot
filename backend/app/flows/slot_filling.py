"""Declarative slot-filling for the booking flow.

Replaces the chain of hardcoded `_advance_step(NEXT_HARDCODED_STEP)` transitions
with a single rule: walk the BOOKING_SLOTS list in order, return the first slot
that still needs to be filled, or None when all are done (→ CONFIRMATION).

Required slots are ones with no fallback (name, service, date, time): they're
asked until filled. Optional slots (email, phone) are asked at most once per
booking — `mark_slot_asked` records the offer so a Skip doesn't loop back.

This is the engine; the prompt copy and rendering for each step still lives
in the existing handlers. Callers use `next_booking_step` to decide where to
go, then dispatch on the returned step.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.enums import ConversationStep
from app.db.models.salon import SalonService
from app.schemas.state import ConversationState


def format_service_label(service: SalonService) -> str:
    """Render a service for a button or list line: ``Hair Cut — ₹500``.

    Em-dash separator visually breaks the name from the price; cleaner than a
    pipe in Telegram's proportional font. Drops trailing zeros for whole-rupee
    prices. Falls back to just the name when the salon hasn't set a price.
    """
    price = service.price
    if not price:
        return service.name
    if float(price) == int(float(price)):
        return f"{service.name} — ₹{int(float(price))}"
    return f"{service.name} — ₹{float(price):.2f}"


@dataclass(frozen=True)
class SlotSpec:
    slot_name: str
    step: ConversationStep
    optional: bool = False


BOOKING_SLOTS: tuple[SlotSpec, ...] = (
    SlotSpec("customer_name",    ConversationStep.CUSTOMER_NAME),
    SlotSpec("service_id",       ConversationStep.SERVICE),
    SlotSpec("appointment_date", ConversationStep.APPOINTMENT_DATE),
    SlotSpec("appointment_time", ConversationStep.APPOINTMENT_TIME),
    # Email and phone are intentionally NOT collected mid-flow — minimizes
    # friction on a chat channel. Phone is auto-captured (WhatsApp webhook
    # carries it; Telegram offers a one-tap "Share Contact" button on first
    # interaction). Email is collected only via the UPDATE_CONTACT menu.
)

_ASKED_KEY = "asked_slots"


def next_booking_step(state: ConversationState) -> ConversationStep | None:
    """Return the first step whose slot is still missing.

    Required slots: returned whenever the value is falsy.
    Optional slots: returned only if the value is falsy AND the slot has not
    been asked yet (tracked via `mark_slot_asked`). This is what prevents a
    skipped email from being re-asked indefinitely.

    Returns None when no slot needs filling — the caller should advance to
    CONFIRMATION.
    """
    asked = set(state.metadata.get(_ASKED_KEY, []))
    for spec in BOOKING_SLOTS:
        if getattr(state.slots, spec.slot_name):
            continue
        if spec.optional and spec.slot_name in asked:
            continue
        return spec.step
    return None


def mark_slot_asked(state: ConversationState, slot_name: str) -> None:
    """Record that a slot has been offered to the user (used for optional slots)."""
    asked = state.metadata.setdefault(_ASKED_KEY, [])
    if slot_name not in asked:
        asked.append(slot_name)


def reset_asked_slots(state: ConversationState) -> None:
    """Clear the asked-slots tracker. Use when starting a fresh booking."""
    state.metadata.pop(_ASKED_KEY, None)
