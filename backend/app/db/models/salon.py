from __future__ import annotations

from typing import Any

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ChannelType
from app.db.models.common import Base, TimestampMixin, UUIDPrimaryKeyMixin


# Use existing PostgreSQL enum type instead of creating a new one
db_channel_type = ENUM("whatsapp", "telegram", name="channel_type", create_type=False)


class Salon(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "salons"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    timezone: Mapped[str] = mapped_column(String(80), nullable=False, default="Asia/Kolkata")
    default_language: Mapped[str] = mapped_column(String(40), nullable=False, default="english")
    flow_config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    entry_config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    channels: Mapped[list["SalonChannel"]] = relationship(back_populates="salon", cascade="all, delete-orphan")
    services: Mapped[list["SalonService"]] = relationship(back_populates="salon", cascade="all, delete-orphan")
    contacts: Mapped[list["SalonNotificationContact"]] = relationship(
        back_populates="salon",
        cascade="all, delete-orphan",
    )
    users: Mapped[list["User"]] = relationship(back_populates="salon")


class SalonChannel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "salon_channels"
    __table_args__ = (UniqueConstraint("salon_id", "channel", name="uq_salon_channel"),)

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[ChannelType] = mapped_column(db_channel_type, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    inbound_identifier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    webhook_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)

    salon: Mapped[Salon] = relationship(back_populates="channels")


class SalonNotificationContact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "salon_notification_contacts"
    __table_args__ = (
        UniqueConstraint("salon_id", "channel", "destination", name="uq_salon_contact_destination"),
    )

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[ChannelType] = mapped_column(db_channel_type, nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    salon: Mapped[Salon] = relationship(back_populates="contacts")


class SalonService(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "salon_services"
    __table_args__ = (UniqueConstraint("salon_id", "code", name="uq_salon_service_code"),)

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=90)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sample_image_urls: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    service_config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    salon: Mapped[Salon] = relationship(back_populates="services")
