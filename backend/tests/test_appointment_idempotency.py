from __future__ import annotations

import unittest
from datetime import date, time
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.services.appointment_service import AppointmentService


def _make_state(*, service_id=None, appt_date=None, appt_time=None):
    return SimpleNamespace(
        slots=SimpleNamespace(
            service_id=service_id or str(uuid4()),
            appointment_date=appt_date or date(2026, 5, 1),
            appointment_time=appt_time or time(14, 0),
            language="english",
            marriage_type="Unknown",
        )
    )


def _make_salon(salon_id=None):
    return SimpleNamespace(
        id=salon_id or uuid4(),
        timezone="Asia/Kolkata",
        default_language="english",
    )


def _make_customer(customer_id=None):
    return SimpleNamespace(id=customer_id or uuid4(), channel="whatsapp")


def _make_integrity_error(constraint_name: str) -> IntegrityError:
    """Build a SQLAlchemy IntegrityError whose .orig stringifies with the
    given constraint name — the same pattern asyncpg's UniqueViolationError
    produces, which is what the production code substring-matches against."""
    class _Orig:
        def __str__(self) -> str:
            return f'duplicate key value violates unique constraint "{constraint_name}"'
    return IntegrityError("INSERT INTO appointments ...", {}, _Orig())


# ---------------------------------------------------------------------------
# Pure key derivation
# ---------------------------------------------------------------------------


class IdempotencyKeyTests(unittest.TestCase):
    def test_key_is_deterministic_for_same_inputs(self):
        salon, customer, state = _make_salon(), _make_customer(), _make_state()
        k1 = AppointmentService._compute_idempotency_key(salon, customer, state)
        k2 = AppointmentService._compute_idempotency_key(salon, customer, state)
        self.assertEqual(k1, k2)

    def test_key_is_sha256_hex_64_chars(self):
        key = AppointmentService._compute_idempotency_key(
            _make_salon(), _make_customer(), _make_state()
        )
        self.assertEqual(len(key), 64)
        int(key, 16)  # raises if not valid hex

    def test_different_salon_yields_different_key(self):
        customer, state = _make_customer(), _make_state()
        k1 = AppointmentService._compute_idempotency_key(_make_salon(), customer, state)
        k2 = AppointmentService._compute_idempotency_key(_make_salon(), customer, state)
        self.assertNotEqual(k1, k2)

    def test_different_customer_yields_different_key(self):
        salon, state = _make_salon(), _make_state()
        k1 = AppointmentService._compute_idempotency_key(salon, _make_customer(), state)
        k2 = AppointmentService._compute_idempotency_key(salon, _make_customer(), state)
        self.assertNotEqual(k1, k2)

    def test_different_service_yields_different_key(self):
        salon, customer = _make_salon(), _make_customer()
        k1 = AppointmentService._compute_idempotency_key(
            salon, customer, _make_state(service_id=str(uuid4()))
        )
        k2 = AppointmentService._compute_idempotency_key(
            salon, customer, _make_state(service_id=str(uuid4()))
        )
        self.assertNotEqual(k1, k2)

    def test_different_date_yields_different_key(self):
        salon, customer = _make_salon(), _make_customer()
        svc = str(uuid4())
        k1 = AppointmentService._compute_idempotency_key(
            salon, customer, _make_state(service_id=svc, appt_date=date(2026, 5, 1))
        )
        k2 = AppointmentService._compute_idempotency_key(
            salon, customer, _make_state(service_id=svc, appt_date=date(2026, 5, 2))
        )
        self.assertNotEqual(k1, k2)

    def test_different_time_yields_different_key(self):
        salon, customer = _make_salon(), _make_customer()
        svc = str(uuid4())
        k1 = AppointmentService._compute_idempotency_key(
            salon, customer, _make_state(service_id=svc, appt_time=time(14, 0))
        )
        k2 = AppointmentService._compute_idempotency_key(
            salon, customer, _make_state(service_id=svc, appt_time=time(15, 0))
        )
        self.assertNotEqual(k1, k2)


# ---------------------------------------------------------------------------
# Dispatch behavior of create_appointment around the new idempotency layer
# ---------------------------------------------------------------------------


class CreateAppointmentIdempotencyTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.service = AppointmentService(db=MagicMock(), email_service=None)
        self.salon = _make_salon()
        self.customer = _make_customer()
        self.state = _make_state()
        self.fresh_appt = SimpleNamespace(booking_reference="ABC123")
        self.existing_appt = SimpleNamespace(booking_reference="XYZ789")

    async def test_fast_path_returns_existing_without_creating(self):
        self.service._find_by_idempotency_key = AsyncMock(return_value=self.existing_appt)
        self.service._create_appointment_atomic = AsyncMock(return_value=self.fresh_appt)

        result = await self.service.create_appointment(self.salon, self.customer, self.state)

        self.assertIs(result, self.existing_appt)
        self.service._create_appointment_atomic.assert_not_awaited()

    async def test_no_existing_proceeds_to_atomic_create(self):
        self.service._find_by_idempotency_key = AsyncMock(return_value=None)
        self.service._create_appointment_atomic = AsyncMock(return_value=self.fresh_appt)

        result = await self.service.create_appointment(self.salon, self.customer, self.state)

        self.assertIs(result, self.fresh_appt)
        self.service._create_appointment_atomic.assert_awaited_once()

    async def test_idempotency_race_resolves_to_concurrent_winner(self):
        # First lookup misses (fast path), second lookup finds the row that the
        # concurrent writer just inserted — that's the row we return.
        self.service._find_by_idempotency_key = AsyncMock(
            side_effect=[None, self.existing_appt]
        )
        self.service._create_appointment_atomic = AsyncMock(
            side_effect=_make_integrity_error("uq_appointment_idempotency")
        )

        result = await self.service.create_appointment(self.salon, self.customer, self.state)

        self.assertIs(result, self.existing_appt)
        self.assertEqual(self.service._find_by_idempotency_key.await_count, 2)

    async def test_unrelated_integrity_error_propagates(self):
        self.service._find_by_idempotency_key = AsyncMock(return_value=None)
        self.service._create_appointment_atomic = AsyncMock(
            side_effect=_make_integrity_error("appointments_booking_reference_key")
        )

        with self.assertRaises(IntegrityError):
            await self.service.create_appointment(self.salon, self.customer, self.state)

    async def test_idempotency_violation_without_winner_propagates(self):
        # Constraint name is ours, but the second lookup also misses — that's
        # data corruption, not a benign race; surface it instead of swallowing.
        self.service._find_by_idempotency_key = AsyncMock(side_effect=[None, None])
        self.service._create_appointment_atomic = AsyncMock(
            side_effect=_make_integrity_error("uq_appointment_idempotency")
        )

        with self.assertRaises(IntegrityError):
            await self.service.create_appointment(self.salon, self.customer, self.state)

    async def test_missing_state_slots_raises_before_lookup(self):
        bad_state = SimpleNamespace(
            slots=SimpleNamespace(
                service_id=None,  # missing
                appointment_date=date(2026, 5, 1),
                appointment_time=time(14, 0),
                language="english",
                marriage_type="Unknown",
            )
        )
        self.service._find_by_idempotency_key = AsyncMock()

        with self.assertRaises(ValueError):
            await self.service.create_appointment(self.salon, self.customer, bad_state)

        self.service._find_by_idempotency_key.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
