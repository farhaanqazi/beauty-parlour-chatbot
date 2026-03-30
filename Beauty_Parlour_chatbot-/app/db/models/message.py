from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.common import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now
from app.db.models.salon import db_channel_type


class InboundMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inbound_messages"

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(db_channel_type, nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class OutboundMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "outbound_messages"

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(db_channel_type, nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
