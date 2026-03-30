from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AppointmentResponse(BaseModel):
    id: UUID
    booking_reference: str
    status: str
    appointment_at: datetime


class CancelAppointmentRequest(BaseModel):
    reason: str | None = None
    cancelled_by: str = "client"
