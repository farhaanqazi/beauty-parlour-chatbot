from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import ChannelType
from app.db.models.customer import Customer
from app.db.models.salon import Salon, SalonChannel, SalonNotificationContact, SalonService
from app.schemas.messages import NormalizedInboundMessage


class TenantService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_salon_by_slug(self, slug: str) -> Salon | None:
        statement = (
            select(Salon)
            .options(
                selectinload(Salon.channels),
                selectinload(Salon.services),
                selectinload(Salon.contacts),
            )
            .where(Salon.slug == slug, Salon.is_active.is_(True))
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def get_salon_by_id(self, salon_id) -> Salon | None:
        statement = (
            select(Salon)
            .options(
                selectinload(Salon.channels),
                selectinload(Salon.services),
                selectinload(Salon.contacts),
            )
            .where(Salon.id == salon_id, Salon.is_active.is_(True))
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    @staticmethod
    def get_channel_config(salon: Salon, channel: ChannelType) -> SalonChannel | None:
        for channel_config in salon.channels:
            if channel_config.channel == channel and channel_config.is_enabled:
                return channel_config
        return None

    @staticmethod
    def get_active_services(salon: Salon) -> list[SalonService]:
        return sorted(
            [service for service in salon.services if service.is_active],
            key=lambda item: (item.sort_order, item.name.lower()),
        )

    @staticmethod
    def get_active_contacts(salon: Salon, channel: ChannelType | None = None) -> list[SalonNotificationContact]:
        contacts = [contact for contact in salon.contacts if contact.is_active]
        if channel:
            contacts = [contact for contact in contacts if contact.channel == channel]
        return contacts

    async def upsert_customer(self, salon: Salon, inbound: NormalizedInboundMessage) -> Customer:
        statement = select(Customer).where(
            Customer.salon_id == salon.id,
            Customer.channel == inbound.channel,
            Customer.external_user_id == inbound.external_user_id,
        )
        result = await self.db.execute(statement)
        customer = result.scalar_one_or_none()
        if not customer:
            customer = Customer(
                salon_id=salon.id,
                channel=inbound.channel,
                external_user_id=inbound.external_user_id,
            )
            self.db.add(customer)

        customer.display_name = inbound.display_name or customer.display_name
        if inbound.channel == ChannelType.WHATSAPP:
            customer.phone_number = inbound.phone_number or inbound.external_user_id
        if inbound.channel == ChannelType.TELEGRAM:
            customer.telegram_chat_id = inbound.telegram_chat_id or inbound.external_user_id
            # Telegram normally doesn't carry a phone — only set when the user
            # taps "Share My Number" and the webhook normalizer pulled it from
            # the contact field. Don't overwrite an existing phone with None.
            if inbound.phone_number:
                customer.phone_number = inbound.phone_number
        await self.db.flush()
        return customer
