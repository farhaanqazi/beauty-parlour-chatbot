from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.enums import ConversationStep
from app.db.models.message import InboundMessage, OutboundMessage
from app.flows.engine import ConversationEngine
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.redis.state_store import RedisStateStore
from app.schemas.messages import FlowResult, NormalizedInboundMessage, OutboundInstruction, ProcessResult
from app.schemas.state import ConversationState
from app.services.appointment_service import AppointmentService
from app.services.tenant_service import TenantService
from app.utils.logger import app_logger


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
        app_logger.info(
            "Inbound message received",
            event="inbound_received",
            channel=inbound.channel.value,
            salon_slug=inbound.salon_slug,
            external_user_id=inbound.external_user_id,
            has_text=bool(inbound.text),
        )

        with app_logger.track_operation(
            "handle_inbound",
            channel=inbound.channel.value,
            salon_slug=inbound.salon_slug,
            external_user_id=inbound.external_user_id,
        ):
            salon = await self.tenant_service.get_salon_by_slug(inbound.salon_slug)
            if not salon:
                app_logger.warn(
                    "Salon not found for inbound message",
                    event="salon_not_found",
                    salon_slug=inbound.salon_slug,
                )
                return ProcessResult()

            channel_config = self.tenant_service.get_channel_config(salon, inbound.channel)
            if not channel_config:
                app_logger.warn(
                    "Channel not configured for salon",
                    event="channel_not_configured",
                    salon_slug=inbound.salon_slug,
                    channel=inbound.channel.value,
                )
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
                app_logger.info(
                    "No services configured — warning sent",
                    event="no_services_warning",
                    salon_slug=inbound.salon_slug,
                )
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
            state_is_new = state is None
            if not state:
                state = ConversationState(
                    salon_id=str(salon.id),
                    channel=inbound.channel,
                    external_user_id=inbound.external_user_id,
                )
                app_logger.info(
                    "New conversation state created",
                    event="state_created",
                    salon_id=str(salon.id),
                    channel=inbound.channel.value,
                    external_user_id=inbound.external_user_id,
                )
            else:
                app_logger.debug(
                    "Existing conversation state loaded",
                    event="state_loaded",
                    salon_id=str(salon.id),
                    channel=inbound.channel.value,
                    external_user_id=inbound.external_user_id,
                    current_step=state.current_step if hasattr(state, "current_step") else "unknown",
                )

            # Handle new tuple return type from process_message (result, state_was_reset)
            result, state_was_reset = await self.engine.process_message(state, inbound.text, salon, active_services)
            result.state.updated_at = datetime.now(timezone.utc)

            booking_reference: str | None = None
            instructions = result.messages
            if result.state.slots.language:
                customer.preferred_language = result.state.slots.language

            if result.should_create_appointment:
                try:
                    appointment = await self.appointment_service.create_appointment(salon, customer, result.state)
                    booking_reference = appointment.booking_reference
                    local_time = appointment.appointment_at.astimezone(ZoneInfo(salon.timezone))
                    instructions = [
                        OutboundInstruction(
                            text=(
                                f"Your appointment is confirmed.\n"
                                f"Booking reference: {appointment.booking_reference}\n"
                                f"Service: {appointment.service_name_snapshot}\n"
                                f"Date: {local_time.strftime('%d %b %Y')}\n"
                                f"Time: {local_time.strftime('%I:%M %p')}"
                            )
                        )
                    ]
                    app_logger.info(
                        "Appointment created via chatbot",
                        event="chatbot_appointment_created",
                        booking_reference=booking_reference,
                        customer_id=str(customer.id),
                        salon_id=str(salon.id),
                    )
                except ValueError as e:
                    # Handle booking conflicts or validation errors gracefully
                    error_message = str(e)
                    app_logger.warn(
                        "Booking validation error detected",
                        event="booking_validation_error",
                        salon_id=str(salon.id),
                        customer_id=str(customer.id),
                        error=error_message,
                    )

                    # Determine which step to reset to based on error type
                    if "3 months" in error_message or "advance" in error_message.lower():
                        # Date is too far in the future - reset to date selection
                        result.state.step = ConversationStep.APPOINTMENT_DATE
                        # Return error + immediate date prompt with buttons
                        from datetime import timedelta as td
                        today = datetime.now(ZoneInfo(salon.timezone)).date()
                        instructions = [
                            OutboundInstruction(text=error_message),
                            OutboundInstruction(
                                text="Please choose a date within the next 3 months:",
                                buttons=[
                                    {"label": "Today", "callback": f"date_{today.isoformat()}"},
                                    {"label": "Tomorrow", "callback": f"date_{(today + td(days=1)).isoformat()}"},
                                    {"label": "Day after tomorrow", "callback": f"date_{(today + td(days=2)).isoformat()}"},
                                ],
                            ),
                        ]
                    elif "business hours" in error_message.lower() or "outside business" in error_message.lower():
                        # Time is outside business hours - reset to time selection
                        result.state.step = ConversationStep.APPOINTMENT_TIME
                        instructions = [
                            OutboundInstruction(text=error_message),
                            OutboundInstruction(
                                text="Please choose a time within business hours:",
                                buttons=[
                                    {"label": "9:00 AM", "callback": "time_09:00"},
                                    {"label": "11:00 AM", "callback": "time_11:00"},
                                    {"label": "1:00 PM", "callback": "time_13:00"},
                                    {"label": "3:00 PM", "callback": "time_15:00"},
                                    {"label": "5:00 PM", "callback": "time_17:00"},
                                ],
                            ),
                        ]
                    else:
                        # Slot booked or other time conflict - reset to time selection
                        result.state.step = ConversationStep.APPOINTMENT_TIME
                        instructions = [
                            OutboundInstruction(text=error_message),
                            OutboundInstruction(
                                text="Please choose a different time:",
                                buttons=[
                                    {"label": "9:00 AM", "callback": "time_09:00"},
                                    {"label": "11:00 AM", "callback": "time_11:00"},
                                    {"label": "1:00 PM", "callback": "time_13:00"},
                                    {"label": "3:00 PM", "callback": "time_15:00"},
                                    {"label": "5:00 PM", "callback": "time_17:00"},
                                ],
                            ),
                        ]

                    result.clear_state = False

            await self.db.commit()

            # Clear state based on result.clear_state OR if state was reset
            if result.clear_state or state_was_reset:
                await self.state_store.clear_state(str(salon.id), inbound.channel.value, inbound.external_user_id)
                app_logger.info(
                    "Conversation state cleared",
                    event="state_cleared",
                    salon_id=str(salon.id),
                    channel=inbound.channel.value,
                    external_user_id=inbound.external_user_id,
                    reason="reset" if state_was_reset else "completed",
                )
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

            app_logger.info(
                "Inbound message fully processed",
                event="inbound_processed",
                channel=inbound.channel.value,
                salon_slug=inbound.salon_slug,
                external_user_id=inbound.external_user_id,
                outbound_count=len(all_outbound_texts),
                booking_reference=booking_reference,
                state_is_new=state_is_new,
            )

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
