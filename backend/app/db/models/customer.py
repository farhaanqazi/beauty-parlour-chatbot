from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import ChannelType
from app.db.models.common import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.db.models.salon import db_channel_type


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("salon_id", "channel", "external_user_id", name="uq_customer_external_user"),
    )

    salon_id = mapped_column(ForeignKey("salons.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[ChannelType] = mapped_column(db_channel_type, nullable=False)
    external_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[str | None] = mapped_column(String(40), nullable=True)

    appointments = relationship("Appointment", back_populates="customer")
