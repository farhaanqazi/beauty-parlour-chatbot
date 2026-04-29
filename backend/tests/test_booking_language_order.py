from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.core.enums import ChannelType, ConversationStep, UserIntent
from app.flows.definitions import build_flow_config
from app.flows.handlers.booking import handle_booking
from app.schemas.messages import FlowResult, OutboundInstruction
from app.schemas.state import ConversationState


class FakeEngine:
    @staticmethod
    def _advance_step(state: ConversationState, new_step: ConversationStep) -> None:
        state.previous_step = state.step
        state.step = new_step
        state.attempt_count = 0

    async def _resolve_choice(self, message_text, options, field_name, language_hint):
        normalized = message_text.removeprefix("lang_").casefold()
        for option in options:
            if normalized in {option["id"].casefold(), option["label"].casefold()}:
                return option
        return None

    async def _resolve_service(self, message_text, services, language_hint):
        del message_text, language_hint
        return services[0] if services else None

    @staticmethod
    def _find_service_by_id(services, service_id):
        return next((service for service in services if str(service.id) == service_id), None)

    @staticmethod
    def _build_date_buttons(timezone_name, include_back=False, fully_booked_dates=None):
        del timezone_name, fully_booked_dates
        buttons = [{"label": "Today", "callback": "date_2026-04-29"}]
        if include_back:
            buttons.append({"label": "Back", "callback": "go_back"})
        buttons.append({"label": "Start Over", "callback": "restart_flow"})
        return buttons, ""

    @staticmethod
    def _invalid_reply(state: ConversationState, prompt: str, buttons=None):
        state.attempt_count += 1
        return FlowResult(
            state=state,
            messages=[OutboundInstruction(text=prompt, buttons=buttons or [])],
        ), False


class BookingLanguageOrderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.engine = FakeEngine()
        self.salon = SimpleNamespace(name="Kashmir Make Over", timezone="Asia/Kolkata")
        self.flow_config = build_flow_config(None)
        self.state = ConversationState(
            salon_id="salon-1",
            channel=ChannelType.TELEGRAM,
            external_user_id="user-1",
        )

    async def test_language_is_asked_before_main_menu(self):
        result, _ = await handle_booking(
            self.engine,
            self.state,
            "hi",
            self.salon,
            [],
            self.flow_config,
            False,
        )

        self.assertEqual(result.state.step, ConversationStep.LANGUAGE)
        self.assertIn("Choose your language", result.messages[0].text)
        self.assertNotIn("What would you like to do", result.messages[0].text)
        self.assertEqual(result.messages[0].buttons[0]["callback"], "lang_english")

    async def test_main_menu_is_shown_after_language_selection(self):
        self.state.step = ConversationStep.LANGUAGE

        result, _ = await handle_booking(
            self.engine,
            self.state,
            "lang_english",
            self.salon,
            [],
            self.flow_config,
            False,
        )

        self.assertEqual(result.state.step, ConversationStep.MAIN_MENU)
        self.assertEqual(result.state.slots.language, "english")
        self.assertIn("What would you like to do", result.messages[0].text)
        self.assertEqual(
            [button["callback"] for button in result.messages[0].buttons],
            ["action_book_new", "action_manage_existing", "restart_flow"],
        )

    async def test_book_action_asks_for_name_after_language_menu(self):
        self.state.step = ConversationStep.MAIN_MENU
        self.state.slots.language = "english"

        result, _ = await handle_booking(
            self.engine,
            self.state,
            "action_book_new",
            self.salon,
            [],
            self.flow_config,
            False,
        )

        self.assertEqual(result.state.intent, UserIntent.NEW_BOOKING)
        self.assertEqual(result.state.step, ConversationStep.CUSTOMER_NAME)
        self.assertEqual(result.messages[0].text, "First, may I have your name?")

    async def test_book_action_from_stale_greeting_state_asks_for_name(self):
        self.state.step = ConversationStep.GREETING
        self.state.slots.language = "english"

        result, _ = await handle_booking(
            self.engine,
            self.state,
            "action_book_new",
            self.salon,
            [],
            self.flow_config,
            False,
        )

        self.assertEqual(result.state.intent, UserIntent.NEW_BOOKING)
        self.assertEqual(result.state.step, ConversationStep.CUSTOMER_NAME)
        self.assertEqual(result.messages[0].text, "First, may I have your name?")

    async def test_service_selection_passes_only_button_list_to_outbound_instruction(self):
        self.state.step = ConversationStep.SERVICE
        self.state.slots.language = "english"
        service = SimpleNamespace(id="svc-1", name="Haircut", code="haircut", service_config={})

        result, _ = await handle_booking(
            self.engine,
            self.state,
            "svc_svc-1",
            self.salon,
            [service],
            self.flow_config,
            False,
        )

        self.assertEqual(result.state.step, ConversationStep.APPOINTMENT_DATE)
        self.assertIsInstance(result.messages[0].buttons[0], dict)
        self.assertEqual(result.messages[0].buttons[0]["callback"], "date_2026-04-29")

    async def test_outbound_instruction_tolerates_button_tuple_helper_result(self):
        buttons, booked_text = self.engine._build_date_buttons("Asia/Kolkata")

        instruction = OutboundInstruction(text="Choose a date" + booked_text, buttons=(buttons, booked_text))

        self.assertEqual(instruction.buttons, buttons)


if __name__ == "__main__":
    unittest.main()
