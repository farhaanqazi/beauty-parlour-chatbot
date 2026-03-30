from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.models.message import InboundMessage, OutboundMessage
from app.flows.engine import ConversationEngine
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.redis.state_store import RedisStateStore
from app.schemas.messages import FlowResult, NormalizedInboundMessage, OutboundInstruction, ProcessResult
from app.schemas.state import ConversationState
from app.services.appointment_service import AppointmentService
from app.services.tenant_service import TenantService


class ConversationService:
    def __init__(
        self,
        db: AsyncSession,
        settings: Settings,
        state_store: RedisStateStore,
        llm_service: LLMService,
        dispatcher: MessageDispatcher,
    ) -> None:
        self.db = db
        self.settings = settings
        self.state_store = state_store
        self.llm_service = llm_service
        self.dispatcher = dispatcher
        self.engine = ConversationEngine(llm_service=llm_service, settings=settings)
        self.tenant_service = TenantService(db)
        self.appointment_service = AppointmentService(db)

    async def handle_inbound(self, inbound: NormalizedInboundMessage) -> ProcessResult:
        salon = await self.tenant_service.get_salon_by_slug(inbound.salon_slug)
        if not salon:
            return ProcessResult()

        channel_config = self.tenant_service.get_channel_config(salon, inbound.channel)
        if not channel_config:
            return ProcessResult()

        active_services = self.tenant_service.get_active_services(salon)
        if not active_services:
            warning_text = "No services are configured for this salon yet."
            deliveries = await self.dispatcher.send_instruction(
                channel_config=channel_config,
                destination=inbound.external_user_id,
                instruction=OutboundInstruction(text=warning_text),
            )
            for delivery in deliveries:
                self.db.add(
                    OutboundMessage(
                        salon_id=salon.id,
                        customer_id=None,
                        channel=inbound.channel,
                        destination=inbound.external_user_id,
                        text=delivery.text,
                        provider_message_id=delivery.provider_message_id,
                        payload=delivery.payload,
                    )
                )
            await self.db.commit()
            return ProcessResult(
                processed_messages=1,
                outbound_messages=[warning_text],
            )

        customer = await self.tenant_service.upsert_customer(salon, inbound)
        self.db.add(
            InboundMessage(
                salon_id=salon.id,
                customer_id=customer.id,
                channel=inbound.channel,
                provider_message_id=inbound.provider_message_id,
                external_user_id=inbound.external_user_id,
                text=inbound.text,
                payload=inbound.raw_payload,
            )
        )

        state = await self.state_store.get_state(str(salon.id), inbound.channel.value, inbound.external_user_id)
        if not state:
            state = ConversationState(
                salon_id=str(salon.id),
                channel=inbound.channel,
                external_user_id=inbound.external_user_id,
            )

        # Handle new tuple return type from process_message (result, state_was_reset)
        result, state_was_reset = await self.engine.process_message(state, inbound.text, salon, active_services)
        result.state.updated_at = datetime.now(timezone.utc)

        booking_reference: str | None = None
        instructions = result.messages
        if result.state.slots.language:
            customer.preferred_language = result.state.slots.language

        if result.should_create_appointment:
            appointment = await self.appointment_service.create_appointment(salon, customer, result.state)
            booking_reference = appointment.booking_reference
            local_time = appointment.appointment_at.astimezone(ZoneInfo(salon.timezone))
            instructions = [
                OutboundInstruction(
                    text=(
                        f"Your appointment is confirmed.\n"
                        f"Booking reference: {appointment.booking_reference}\n"
                        f"Service: {appointment.service_name_snapshot}\n"
                        f"Marriage type: {appointment.marriage_type}\n"
                        f"Date: {local_time.strftime('%d %b %Y')}\n"
                        f"Time: {local_time.strftime('%I:%M %p')}"
                    )
                )
            ]

        await self.db.commit()

        # Clear state based on result.clear_state OR if state was reset
        if result.clear_state or state_was_reset:
            await self.state_store.clear_state(str(salon.id), inbound.channel.value, inbound.external_user_id)
        else:
            await self.state_store.save_state(result.state)

        localized_instructions = await self._localize_instructions(
            instructions,
            result.state.slots.language or salon.default_language,
        )

        all_outbound_texts: list[str] = []
        for instruction in localized_instructions:
            deliveries = await self.dispatcher.send_instruction(
                channel_config=channel_config,
                destination=inbound.external_user_id,
                instruction=instruction,
            )
            all_outbound_texts.append(instruction.text)
            for delivery in deliveries:
                self.db.add(
                    OutboundMessage(
                        salon_id=salon.id,
                        customer_id=customer.id,
                        channel=inbound.channel,
                        destination=inbound.external_user_id,
                        text=delivery.text,
                        provider_message_id=delivery.provider_message_id,
                        payload=delivery.payload,
                    )
                )
        await self.db.commit()

        return ProcessResult(
            processed_messages=1,
            outbound_messages=all_outbound_texts,
            created_booking_reference=booking_reference,
        )

    async def _localize_instructions(
        self,
        instructions: list[OutboundInstruction],
        target_language: str | None,
    ) -> list[OutboundInstruction]:
        localized: list[OutboundInstruction] = []
        for instruction in instructions:
            localized_text = await self.llm_service.localize_text(instruction.text, target_language)
            localized.append(OutboundInstruction(text=localized_text, media_urls=instruction.media_urls))
        return localized
