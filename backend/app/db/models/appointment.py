from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import AppointmentStatus, NotificationJobStatus, NotificationJobType
from app.db.models.common import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.db.models.salon import db_channel_type


class Appointment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "appointments"

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = mapped_column(ForeignKey("salon_services.id", ondelete="SET NULL"), nullable=True, index=True)

    booking_reference: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    channel: Mapped[str] = mapped_column(db_channel_type, nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(
            AppointmentStatus,
            name="appointment_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            create_type=False,  # Use existing PostgreSQL enum, do not attempt to create
            native_enum=True,   # Keep PostgreSQL native enum type
        ),
        nullable=False,
        default=AppointmentStatus.CONFIRMED,
    )
    language: Mapped[str] = mapped_column(String(40), nullable=False)
    marriage_type: Mapped[str] = mapped_column(String(40), nullable=False)
    service_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    appointment_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    booking_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    customer = relationship("Customer", back_populates="appointments")
    service = relationship("SalonService")
    salon = relationship("Salon")
    notification_jobs = relationship("NotificationJob", back_populates="appointment")


class NotificationJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notification_jobs"
    __table_args__ = (UniqueConstraint("appointment_id", "job_type", name="uq_appointment_job_type"),)

    appointment_id = mapped_column(ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True)
    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    job_type: Mapped[NotificationJobType] = mapped_column(
        SAEnum(
            NotificationJobType,
            name="notification_job_type",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            create_type=False,
        ),
        nullable=False,
    )
    status: Mapped[NotificationJobStatus] = mapped_column(
        SAEnum(
            NotificationJobStatus,
            name="notification_job_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            create_type=False,
        ),
        nullable=False,
        default=NotificationJobStatus.PENDING,
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    appointment = relationship("Appointment", back_populates="notification_jobs")
