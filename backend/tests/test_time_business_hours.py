from __future__ import annotations

import unittest
from datetime import date, time
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.flows.engine import ConversationEngine
from app.flows.handlers.scheduling import _prefer_business_hour_for_ambiguous_time


class BusinessHourTimeParsingTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        llm_service = SimpleNamespace(parse_time=AsyncMock(return_value=None))
        self.engine = ConversationEngine(llm_service=llm_service, settings=SimpleNamespace())
        self.salon = SimpleNamespace(flow_config={"opening_hour": 9, "closing_hour": 18})

    async def test_plain_9_prefers_9_am_when_salon_is_open(self):
        parsed = await self.engine._parse_time("9", "Asia/Kolkata", date(2026, 4, 30), "english")

        adjusted = _prefer_business_hour_for_ambiguous_time(self.engine, self.salon, "9", parsed)

        self.assertEqual(adjusted, time(9, 0))

    async def test_colon_time_prefers_pm_when_am_is_outside_hours(self):
        parsed = await self.engine._parse_time("5:30", "Asia/Kolkata", date(2026, 4, 30), "english")

        adjusted = _prefer_business_hour_for_ambiguous_time(self.engine, self.salon, "5:30", parsed)

        self.assertEqual(adjusted, time(17, 30))

    async def test_explicit_pm_is_not_reinterpreted(self):
        parsed = await self.engine._parse_time("9 PM", "Asia/Kolkata", date(2026, 4, 30), "english")

        adjusted = _prefer_business_hour_for_ambiguous_time(self.engine, self.salon, "9 PM", parsed)

        self.assertEqual(adjusted, time(21, 0))


if __name__ == "__main__":
    unittest.main()
