from __future__ import annotations

import unittest
from datetime import date, time

from app.core.enums import ChannelType, ConversationStep
from app.flows.slot_filling import (
    BOOKING_SLOTS,
    mark_slot_asked,
    next_booking_step,
    reset_asked_slots,
)
from app.schemas.state import ConversationState


def _state() -> ConversationState:
    return ConversationState(
        salon_id="salon-1",
        channel=ChannelType.TELEGRAM,
        external_user_id="user-1",
    )


class NextBookingStepTests(unittest.TestCase):
    def test_empty_state_asks_for_name_first(self):
        self.assertEqual(next_booking_step(_state()), ConversationStep.CUSTOMER_NAME)

    def test_with_name_asks_for_service(self):
        s = _state()
        s.slots.customer_name = "Farhaan"
        self.assertEqual(next_booking_step(s), ConversationStep.SERVICE)

    def test_with_name_and_service_asks_for_date(self):
        s = _state()
        s.slots.customer_name = "Farhaan"
        s.slots.service_id = "svc-1"
        self.assertEqual(next_booking_step(s), ConversationStep.APPOINTMENT_DATE)

    def test_with_date_asks_for_time(self):
        s = _state()
        s.slots.customer_name = "Farhaan"
        s.slots.service_id = "svc-1"
        s.slots.appointment_date = date(2026, 5, 15)
        self.assertEqual(next_booking_step(s), ConversationStep.APPOINTMENT_TIME)

    def test_with_time_goes_to_confirmation(self):
        """All required slots filled → no further prompts (email/phone not asked in chat)."""
        s = _state()
        s.slots.customer_name = "Farhaan"
        s.slots.service_id = "svc-1"
        s.slots.appointment_date = date(2026, 5, 15)
        s.slots.appointment_time = time(16, 0)
        self.assertIsNone(next_booking_step(s))

    def test_email_on_file_irrelevant_to_flow(self):
        """Email never blocks or prompts; only required slots matter."""
        s = _state()
        s.slots.customer_name = "Farhaan"
        s.slots.service_id = "svc-1"
        s.slots.appointment_date = date(2026, 5, 15)
        s.slots.appointment_time = time(16, 0)
        s.slots.email = "user@example.com"
        self.assertIsNone(next_booking_step(s))

    def test_phone_irrelevant_to_flow_when_required_filled(self):
        s = _state()
        s.slots.customer_name = "Farhaan"
        s.slots.service_id = "svc-1"
        s.slots.appointment_date = date(2026, 5, 15)
        s.slots.appointment_time = time(16, 0)
        s.slots.phone_number = None  # auto-capture didn't fire
        self.assertIsNone(next_booking_step(s))

    def test_required_slot_keeps_being_asked_even_after_mark(self):
        """mark_slot_asked is a no-op for required slots — they're asked until filled."""
        s = _state()
        mark_slot_asked(s, "customer_name")
        self.assertEqual(next_booking_step(s), ConversationStep.CUSTOMER_NAME)

    def test_returning_customer_with_phone_no_service_goes_to_service(self):
        """Returning customer entry: name + phone on file, no booking yet → ask SERVICE first."""
        s = _state()
        s.slots.customer_name = "Farhaan"
        s.slots.phone_number = "9999999999"
        self.assertEqual(next_booking_step(s), ConversationStep.SERVICE)


class MarkSlotAskedTests(unittest.TestCase):
    def test_marking_is_idempotent(self):
        s = _state()
        mark_slot_asked(s, "email")
        mark_slot_asked(s, "email")
        self.assertEqual(s.metadata["asked_slots"], ["email"])

    def test_reset_clears_marks(self):
        s = _state()
        mark_slot_asked(s, "email")
        mark_slot_asked(s, "phone_number")
        reset_asked_slots(s)
        self.assertNotIn("asked_slots", s.metadata)


class BookingSlotsShapeTests(unittest.TestCase):
    def test_slot_names_match_conversation_slots_fields(self):
        from app.schemas.state import ConversationSlots
        valid_fields = set(ConversationSlots.model_fields.keys())
        for spec in BOOKING_SLOTS:
            self.assertIn(spec.slot_name, valid_fields, f"unknown slot: {spec.slot_name}")

    def test_no_optional_slots_in_chat_flow(self):
        """Email and phone are intentionally collected outside the chat flow."""
        optional = {spec.slot_name for spec in BOOKING_SLOTS if spec.optional}
        self.assertEqual(optional, set())


if __name__ == "__main__":
    unittest.main()
