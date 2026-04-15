from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.enums import ConversationStep, UserIntent
from app.db.models.appointment import Appointment
from app.db.models.message import InboundMessage, OutboundMessage
from app.flows.engine import ConversationEngine
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.redis.state_store import RedisStateStore
from app.schemas.messages import FlowResult, NormalizedInboundMessage, OutboundInstruction, ProcessResult
from app.schemas.state import ConversationState
from app.services.appointment_service import AppointmentService
from app.services.email_service import EmailService
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
        email_service: EmailService | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.state_store = state_store
        self.llm_service = llm_service
        self.dispatcher = dispatcher
        self.appointment_service = AppointmentService(db, email_service=email_service)
        self.engine = ConversationEngine(
            llm_service=llm_service,
            settings=settings,
            appointment_service=self.appointment_service,
        )
        self.tenant_service = TenantService(db)

    async def handle_inbound(self, inbound: NormalizedInboundMessage) -> ProcessResult:
        app_logger.info(
            "Inbound message received",
            event="inbound_received",
            channel=inbound.channel.value,
            salon_slug=inbound.salon_slug,
            external_user_id=inbound.external_user_id,
            has_text=bool(inbound.text),
        )

        # Deduplication: Skip if this message was already processed (webhook retry)
        # Use external_user_id as the unique key for deduplication
        if inbound.provider_message_id:
            is_duplicate = await self.state_store.is_message_processed(
                inbound.external_user_id,  # Use external_user_id as the unique key
                inbound.channel.value,
                inbound.external_user_id,
                inbound.provider_message_id,
            )
            if is_duplicate:
                app_logger.info(
                    "Duplicate message skipped",
                    event="duplicate_skipped",
                    message_id=inbound.provider_message_id,
                )
                return ProcessResult()

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
            # OPTIMIZATION: Don't write InboundMessage to DB on every interaction
            # Only persist to DB when appointment is confirmed (below)
            # State is stored in Redis (memory) for fast access during the flow

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

            # Capture the step before processing to know where we started
            step_before_process = state.step if state else None

            # Handle new tuple return type from process_message (result, state_was_reset)
            result, state_was_reset = await self.engine.process_message(
                state, inbound.text, salon, active_services, customer=customer
            )
            result.state.updated_at = datetime.now(timezone.utc)

            # --- MANAGE APPOINTMENT LOOKUP INTERCEPT ---
            # If the engine signals a lookup request, perform the DB lookup and display results
            if (
                result.messages
                and result.messages[0].text == "__LOOKUP_APPOINTMENTS__"
                and result.state.intent == UserIntent.MANAGE_BOOKING
            ):
                upcoming = await self.appointment_service.lookup_active_appointments(customer, salon)

                if not upcoming:
                    # No appointments found
                    result.messages = [
                        OutboundInstruction(
                            text="I couldn't find any upcoming appointments for you. Would you like to book a new one?",
                            buttons=[
                                {"label": "📅 Book", "callback": "action_book_new"},
                                {"label": "🔄 Start Over", "callback": "restart_flow"},
                            ],
                        )
                    ]
                    result.state.intent = UserIntent.NEW_BOOKING
                    result.state.step = ConversationStep.GREETING
                else:
                    # If multiple appointments, let user select which one to manage
                    if len(upcoming) > 1:
                        # Store all appointment IDs in state metadata for numeric selection
                        appointment_ids = [str(a.id) for a in upcoming]
                        state.metadata['appointment_ids'] = appointment_ids
                        
                        # Build numbered list of appointments (clean text format - no buttons)
                        apt_list = "\n".join(
                            f"{i+1}. {a.service_name_snapshot} — {a.appointment_at.astimezone(ZoneInfo(salon.timezone)).strftime('%d %b, %I:%M %p')}"
                            for i, a in enumerate(upcoming)
                        )

                        result.messages = [
                            OutboundInstruction(
                                text=(
                                    f"I found {len(upcoming)} upcoming appointments:\n\n"
                                    f"{apt_list}\n\n"
                                    f"Reply with the number to manage (e.g., type *1* or *2*)"
                                ),
                                buttons=[
                                    {"label": "🔄 Start Over", "callback": "restart_flow"},
                                ],
                            )
                        ]
                        result.state.step = ConversationStep.SELECT_APPOINTMENT
                    else:
                        # Single appointment - proceed directly to action menu
                        apt: Appointment = upcoming[0]
                        local_time = apt.appointment_at.astimezone(ZoneInfo(salon.timezone))
                        date_str = local_time.strftime("%A, %d %b %Y")
                        time_str = local_time.strftime("%I:%M %p")

                        # Pre-fill state with appointment data for rescheduling
                        result.state.target_appointment_id = str(apt.id)
                        result.state.slots.service_id = str(apt.service_id) if apt.service_id else None
                        result.state.slots.service_name = apt.service_name_snapshot
                        result.state.slots.appointment_date = local_time.date()
                        result.state.slots.appointment_time = local_time.time()
                        result.state.slots.customer_name = customer.display_name

                        result.messages = [
                            OutboundInstruction(
                                text=(
                                    f"Here's your upcoming appointment:\n\n"
                                    f"📋 **{apt.service_name_snapshot}**\n"
                                    f"Ref: {apt.booking_reference}\n"
                                    f"📅 {date_str}\n"
                                    f"⏰ {time_str}\n\n"
                                    f"What would you like to do?"
                                ),
                                buttons=[
                                    {"label": "🔄 Reschedule", "callback": "action_reschedule"},
                                    {"label": "❌ Cancel", "callback": "action_cancel"},
                                    {"label": "✅ Keep", "callback": "action_keep"},
                                    {"label": "🔄 Start Over", "callback": "restart_flow"},
                                ],
                            )
                        ]
                        # Set step to MANAGE_APPOINTMENT_MENU so the engine handles subsequent actions
                        result.state.step = ConversationStep.MANAGE_APPOINTMENT_MENU
            # --- END MANAGE APPOINTMENT LOOKUP INTERCEPT ---

            # --- APPOINTMENT TIME VALIDATION INTERCEPT ---
            # If the user confirmed a time and is proceeding to email, validate against DB
            # Note: Flow now goes APPOINTMENT_TIME → TIME_CONFIRMATION → EMAIL
            if step_before_process == ConversationStep.TIME_CONFIRMATION and result.state.step == ConversationStep.EMAIL:
                try:
                    from uuid import UUID
                    appointment_at = datetime.combine(
                        result.state.slots.appointment_date,
                        result.state.slots.appointment_time,
                        tzinfo=ZoneInfo(salon.timezone),
                    ).astimezone(ZoneInfo("UTC"))
                    
                    self.appointment_service._validate_business_hours(appointment_at, salon)
                    
                    service_id_str = result.state.slots.service_id
                    if service_id_str:
                        service = await self.appointment_service._get_service(UUID(service_id_str))
                        if service:
                            overlap = await self.appointment_service._check_availability_locked(salon.id, appointment_at, service)
                            if overlap:
                                raise ValueError("This time slot is already booked. Please choose another.")
                except ValueError as e:
                    error_message = str(e)
                    app_logger.warn(
                        "Time slot validation failed during flow",
                        event="flow_validation_error",
                        salon_id=str(salon.id),
                        customer_id=str(customer.id),
                        error=error_message,
                    )
                    
                    # Override the transition and revert to APPOINTMENT_TIME
                    result.state.step = ConversationStep.APPOINTMENT_TIME
                    
                    # Generate time slots based on salon business hours
                    start_hour, end_hour = 9, 18
                    if hasattr(salon, 'business_hours') and salon.business_hours:
                        try:
                            hours_str = str(salon.business_hours)
                            if '-' in hours_str:
                                s_str, e_str = hours_str.split('-')
                                start_hour = int(s_str.split(':')[0])
                                end_hour = int(e_str.split(':')[0])
                        except (ValueError, AttributeError):
                            pass
                            
                    time_buttons = []
                    for hour in range(start_hour, end_hour):
                        from datetime import time as dt_time
                        time_obj = dt_time(hour=hour, minute=0)
                        label = time_obj.strftime("%I:%M %p").lstrip('0')
                        time_buttons.append({"label": label, "callback": f"time_{hour:02d}:00"})
                    time_buttons.append({"label": "⬅️ Back", "callback": "go_back"})
                    time_buttons.append({"label": "🔄 Start Over", "callback": "restart_flow"})
                        
                    result.messages = [
                        OutboundInstruction(text=error_message),
                        OutboundInstruction(
                            text="Please choose a different time:",
                            buttons=time_buttons,
                        ),
                    ]
            # --- END APPOINTMENT TIME VALIDATION INTERCEPT ---

            booking_reference: str | None = None
            instructions = result.messages
            if result.state.slots.language:
                customer.preferred_language = result.state.slots.language

            # --- CANCELLATION INTERCEPT ---
            if result.should_cancel_appointment and result.state.target_appointment_id:
                try:
                    from uuid import UUID
                    appointment = await self.appointment_service.cancel_appointment(
                        UUID(result.state.target_appointment_id),
                        salon_id=salon.id,
                        reason="Cancelled via chatbot",
                        cancelled_by="client",
                    )
                    if appointment:
                        instructions = [
                            OutboundInstruction(
                                text=f"Your appointment {appointment.booking_reference} has been cancelled."
                            )
                        ]
                    else:
                        instructions = [
                            OutboundInstruction(text="Could not find the appointment to cancel.")
                        ]
                    booking_reference = None
                    
                    # Commit the transaction to persist the cancellation
                    await self.db.commit()
                except Exception as e:
                    app_logger.error(
                        "Failed to cancel appointment via chatbot",
                        event="cancellation_error",
                        error=str(e),
                    )
                    instructions = [
                        OutboundInstruction(text="Sorry, something went wrong while cancelling. Please try again or contact the salon.")
                    ]
            # --- END CANCELLATION INTERCEPT ---

            # --- RESCHEDULE INTERCEPT ---
            elif result.should_update_appointment and result.state.target_appointment_id:
                try:
                    from uuid import UUID
                    appointment = await self.appointment_service.get_appointment(
                        UUID(result.state.target_appointment_id)
                    )
                    if appointment and result.state.slots.appointment_date and result.state.slots.appointment_time:
                        updated = await self.appointment_service.update_appointment_time(
                            appointment,
                            salon,
                            result.state.slots.appointment_date,
                            result.state.slots.appointment_time,
                        )
                        local_time = updated.appointment_at.astimezone(ZoneInfo(salon.timezone))
                        instructions = [
                            OutboundInstruction(
                                text=(
                                    f"Your appointment has been rescheduled.\n"
                                    f"Booking reference: {updated.booking_reference}\n"
                                    f"Service: {updated.service_name_snapshot}\n"
                                    f"New Date: {local_time.strftime('%d %b %Y')}\n"
                                    f"New Time: {local_time.strftime('%I:%M %p')}"
                                )
                            )
                        ]
                        booking_reference = updated.booking_reference
                        
                        # Commit the transaction to persist the reschedule changes
                        await self.db.commit()
                    else:
                        instructions = [
                            OutboundInstruction(text="Could not find the appointment or missing details to reschedule.")
                        ]
                except ValueError as e:
                    error_message = str(e)
                    app_logger.warn(
                        "Reschedule validation error",
                        event="reschedule_validation_error",
                        error=error_message,
                    )
                    # Reset to date selection so user can try again
                    result.state.step = ConversationStep.APPOINTMENT_DATE
                    result.clear_state = False
                    today = datetime.now(ZoneInfo(salon.timezone)).date()
                    date_buttons = []
                    for i in range(7):
                        target_date = today + timedelta(days=i)
                        if i == 0:
                            label = "Today"
                        elif i == 1:
                            label = "Tomorrow"
                        else:
                            label = target_date.strftime("%a %d %b")
                        date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
                    instructions = [
                        OutboundInstruction(text=error_message),
                        OutboundInstruction(
                            text="Please choose a different date:",
                            buttons=date_buttons,
                        ),
                    ]
                except Exception as e:
                    app_logger.error(
                        "Failed to reschedule appointment via chatbot",
                        event="reschedule_error",
                        error=str(e),
                    )
                    instructions = [
                        OutboundInstruction(text="Sorry, something went wrong while rescheduling. Please try again or contact the salon.")
                    ]
            # --- END RESCHEDULE INTERCEPT ---

            elif result.should_create_appointment:
                # ONLY write to DB when appointment is confirmed
                # Materialize IDs before try block so error handler doesn't touch expired ORM objects
                _salon_id = str(salon.id)
                _customer_id = str(customer.id)
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
                    
                    # NOW persist to DB: InboundMessage, OutboundMessage, and appointment
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
                    
                    for instruction in instructions:
                        self.db.add(
                            OutboundMessage(
                                salon_id=salon.id,
                                customer_id=customer.id,
                                channel=inbound.channel,
                                destination=inbound.external_user_id,
                                provider_message_id=None,  # Will be updated after sending
                                text=instruction.text,
                                payload={},
                            )
                        )
                    
                    await self.db.commit()
                    
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
                        salon_id=_salon_id,
                        customer_id=_customer_id,
                        error=error_message,
                    )

                    # Determine which step to reset to based on error type
                    if "3 months" in error_message or "advance" in error_message.lower():
                        # Date is too far in the future - reset to date selection
                        result.state.step = ConversationStep.APPOINTMENT_DATE
                        # Return error + immediate date prompt with buttons (next 7 days)
                        from datetime import timedelta as td
                        today = datetime.now(ZoneInfo(salon.timezone)).date()
                        date_buttons = []
                        for i in range(7):
                            target_date = today + td(days=i)
                            if i == 0:
                                label = "Today"
                            elif i == 1:
                                label = "Tomorrow"
                            else:
                                label = target_date.strftime("%a %d %b")
                            date_buttons.append({"label": label, "callback": f"date_{target_date.isoformat()}"})
                        instructions = [
                            OutboundInstruction(text=error_message),
                            OutboundInstruction(
                                text="Please choose a date within the next 7 days:",
                                buttons=date_buttons,
                            ),
                        ]
                    elif "business hours" in error_message.lower() or "outside business" in error_message.lower():
                        # Time is outside business hours - reset to time selection
                        result.state.step = ConversationStep.APPOINTMENT_TIME
                        # Generate hourly time slots (9 AM - 6 PM)
                        time_buttons = []
                        for hour in range(9, 18):
                            time_obj = datetime.strptime(f"{hour:02d}:00", "%H:%M").time()
                            label = time_obj.strftime("%I:%M %p").lstrip('0')
                            time_buttons.append({"label": label, "callback": f"time_{hour:02d}:00"})
                        instructions = [
                            OutboundInstruction(text=error_message),
                            OutboundInstruction(
                                text="Please choose a time within business hours:",
                                buttons=time_buttons,
                            ),
                        ]
                    else:
                        # Slot booked or other time conflict - reset to time selection
                        result.state.step = ConversationStep.APPOINTMENT_TIME
                        # Generate hourly time slots (9 AM - 6 PM)
                        time_buttons = []
                        for hour in range(9, 18):
                            time_obj = datetime.strptime(f"{hour:02d}:00", "%H:%M").time()
                            label = time_obj.strftime("%I:%M %p").lstrip('0')
                            time_buttons.append({"label": label, "callback": f"time_{hour:02d}:00"})
                        instructions = [
                            OutboundInstruction(text=error_message),
                            OutboundInstruction(
                                text="Please choose a different time:",
                                buttons=time_buttons,
                            ),
                        ]

                    result.clear_state = False

            # OPTIMIZATION: Removed DB commit here - only commit when appointment is confirmed
            # State is saved to Redis (memory) for fast access

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
                # OPTIMIZATION: Removed OutboundMessage DB writes here
                # Only persist to DB when appointment is confirmed (above)

            # OPTIMIZATION: Removed final DB commit - already committed during appointment creation

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

            # Mark message as processed to prevent duplicate processing (webhook retries)
            if inbound.provider_message_id:
                await self.state_store.mark_message_processed(
                    inbound.external_user_id,  # Match the key used in is_message_processed
                    inbound.channel.value,
                    inbound.external_user_id,
                    inbound.provider_message_id,
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
        # Simple dictionary-based translations for common phrases (fast & free)
        TRANSLATIONS = {
            "hinglish": {
                "First, may I have your name?": "Pehle, kya aap apna naam bata sakte hain?",
                "Thanks, {name}! Which service do you need:": "Shukriya, {name}! Aapko kaunsi service chahiye:",
                "Please choose your preferred appointment date:": "Apni pasandida date choose karein:",
                "You can type a date like \"25 March\" or \"next Friday\", or tap one of the buttons above. Type \"restart\" to start over.": "Aap \"25 March\" ya \"next Friday\" likh sakte hain, ya upar koi button dabayein. \"restart\" likhein shuru karne ke liye.",
                "What time would you like to book?\n💡 Or type your preferred time (e.g. 4:30 PM, 17:30)": "Aap kis time book karna chenge?\n💡 Ya apna time type karein (jaise 4:30 PM, 17:30)",
                "Almost done! Please provide your email address to receive the booking confirmation:": "Bas ho gaya! Apna email address dein booking confirmation lene ke liye:",
                "Please provide a valid email address (e.g., name@example.com).": "Ek valid email address dein (jaise, name@example.com).",
                "Reply HI to start a new booking.": "Nayi booking ke liye HI reply karein.",
                "Appointment request cancelled. Reply HI whenever you want to start again.": "Booking cancel ho gayi. Jab bhi start karna ho, HI reply karein.",
            },
            "hindi": {
                "First, may I have your name?": "सबसे पहले, क्या आप अपना नाम बता सकते हैं?",
                "Thanks, {name}! Which service do you need:": "धन्यवाद, {name}! आपको कौनसी सेवा चाहिए:",
                "Please choose your preferred appointment date:": "कृपया अपनी पसंदीदा तिथि चुनें:",
                "You can type a date like \"25 March\" or \"next Friday\", or tap one of the buttons above. Type \"restart\" to start over.": "आप \"25 March\" या \"next Friday\" लिख सकते हैं, या ऊपर कोई बटन दबाएं। पुनः शुरू करने के लिए \"restart\" लिखें।",
                "What time would you like to book?\n💡 Or type your preferred time (e.g. 4:30 PM, 17:30)": "आप किस समय बुक करना चाहेंगे?\n💡 या अपना समय टाइप करें (जैसे 4:30 PM, 17:30)",
                "Almost done! Please provide your email address to receive the booking confirmation:": "बस हो गया! बुकिंग पुष्टि पाने के लिए अपना ईमेल पता दें:",
                "Please provide a valid email address (e.g., name@example.com).": "कृपया एक वैध ईमेल पता दें (जैसे, name@example.com)।",
                "Reply HI to start a new booking.": "नई बुकिंग के लिए HI रिप्लाई करें।",
                "Appointment request cancelled. Reply HI whenever you want to start again.": "बुकिंग रद्द हो गई। जब भी शुरू करना हो, HI रिप्लाई करें।",
            },
            "telugu": {
                "First, may I have your name?": "ముందుగా, మీ పేరు చెప్పగలరా?",
                "Thanks, {name}! Which service do you need:": "ధన్యవాదాలు, {name}! మీకు ఏ సేవ కావాలి:",
            }
        }

        localized: list[OutboundInstruction] = []
        lang = (target_language or "english").lower()
        translations = TRANSLATIONS.get(lang, {})

        for instruction in instructions:
            # Try dictionary translation first
            localized_text = translations.get(instruction.text, instruction.text)
            
            # Fallback to LLM if no dictionary match and LLM is available
            if localized_text == instruction.text and lang != "english":
                localized_text = await self.llm_service.localize_text(instruction.text, target_language)
            
            localized.append(OutboundInstruction(
                text=localized_text,
                media_urls=instruction.media_urls,
                buttons=instruction.buttons,
            ))
        return localized
