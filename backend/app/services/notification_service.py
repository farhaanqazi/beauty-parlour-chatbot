from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Iterable, Sequence
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.enums import AppointmentStatus, NotificationJobStatus, NotificationJobType
from app.db.models.appointment import Appointment, NotificationJob
from app.db.models.common import utc_now
from app.db.models.message import OutboundMessage
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.schemas.messages import OutboundInstruction
from app.services.tenant_service import TenantService


class NotificationService:
    def __init__(
        self,
        db: AsyncSession,
        dispatcher: MessageDispatcher,
        llm_service: LLMService,
        batch_size: int = 50,
    ) -> None:
        self.db = db
        self.dispatcher = dispatcher
        self.llm_service = llm_service
        self.batch_size = batch_size
        self.tenant_service = TenantService(db)

    async def run_once(self) -> int:
        jobs = await self.claim_due_jobs()
        if not jobs:
            return 0

        digest_jobs = [
            job for job in jobs if job.job_type in {NotificationJobType.SALON_DIGEST_60, NotificationJobType.SALON_DIGEST_15}
        ]
        single_jobs = [job for job in jobs if job.job_type not in {NotificationJobType.SALON_DIGEST_60, NotificationJobType.SALON_DIGEST_15}]

        processed = 0
        if digest_jobs:
            processed += await self._process_digest_jobs(digest_jobs)
        for job in single_jobs:
            await self.process_job(job)
            processed += 1
        return processed

    async def process_job_ids(self, job_ids: Sequence) -> int:
        if not job_ids:
            return 0
        statement = (
            select(NotificationJob)
            .where(NotificationJob.id.in_(job_ids))
            .options(joinedload(NotificationJob.appointment).joinedload(Appointment.customer))
        )
        result = await self.db.execute(statement)
        jobs = list(result.scalars().unique().all())
        for job in jobs:
            job.status = NotificationJobStatus.PROCESSING
            job.locked_at = utc_now()
            job.attempts += 1
        await self.db.commit()

        processed = 0
        for job in jobs:
            await self.process_job(job)
            processed += 1
        return processed

    async def claim_due_jobs(self) -> list[NotificationJob]:
        now = utc_now()
        stale_cutoff = now - timedelta(minutes=5)
        statement = (
            select(NotificationJob)
            .where(NotificationJob.due_at <= now)
            .where(
                or_(
                    NotificationJob.status == NotificationJobStatus.PENDING,
                    and_(
                        NotificationJob.status == NotificationJobStatus.PROCESSING,
                        NotificationJob.locked_at.is_not(None),
                        NotificationJob.locked_at < stale_cutoff,
                    ),
                    and_(
                        NotificationJob.status == NotificationJobStatus.FAILED,
                        NotificationJob.attempts < 3,
                    ),
                )
            )
            .order_by(NotificationJob.due_at.asc())
            .limit(self.batch_size)
            .with_for_update(skip_locked=True)
        )
        result = await self.db.execute(statement)
        jobs = list(result.scalars().all())
        for job in jobs:
            job.status = NotificationJobStatus.PROCESSING
            job.locked_at = now
            job.attempts += 1
        await self.db.commit()
        return jobs

    async def process_job(self, job: NotificationJob) -> None:
        try:
            appointment = await self._load_appointment(job.appointment_id)
            if not appointment:
                await self._mark_job_sent(job)
                return

            if job.job_type in {NotificationJobType.CUSTOMER_REMINDER_60, NotificationJobType.CUSTOMER_REMINDER_15}:
                await self._send_customer_reminder(job, appointment)
            elif job.job_type == NotificationJobType.CUSTOMER_CANCELLATION:
                await self._send_customer_cancellation(job, appointment)
            elif job.job_type in {NotificationJobType.SALON_DIGEST_60, NotificationJobType.SALON_DIGEST_15}:
                await self._process_digest_jobs([job])
                return
            else:
                await self._mark_job_sent(job)
                return
            await self._mark_job_sent(job)
        except Exception as exc:  # noqa: BLE001
            await self._mark_job_failed(job, str(exc))

    async def _process_digest_jobs(self, jobs: Iterable[NotificationJob]) -> int:
        grouped: dict[tuple[str, NotificationJobType], list[NotificationJob]] = defaultdict(list)
        for job in jobs:
            grouped[(str(job.salon_id), job.job_type)].append(job)

        processed = 0
        for (salon_id, job_type), job_group in grouped.items():
            try:
                salon = await self.tenant_service.get_salon_by_id(job_group[0].salon_id)
                if not salon:
                    for job in job_group:
                        await self._mark_job_sent(job)
                    continue

                appointment_ids = [job.appointment_id for job in job_group]
                statement = (
                    select(Appointment)
                    .options(joinedload(Appointment.customer))
                    .where(Appointment.id.in_(appointment_ids))
                    .order_by(Appointment.appointment_at.asc())
                )
                result = await self.db.execute(statement)
                appointments = [
                    appointment
                    for appointment in result.scalars().unique().all()
                    if appointment.status == AppointmentStatus.CONFIRMED
                ]

                if not appointments:
                    for job in job_group:
                        await self._mark_job_sent(job)
                    continue

                contacts = self.tenant_service.get_active_contacts(salon)
                if not contacts:
                    for job in job_group:
                        await self._mark_job_failed(job, "No active salon notification contacts configured.")
                    continue

                label = "1 hour" if job_type == NotificationJobType.SALON_DIGEST_60 else "15 minutes"
                lines = [f"Upcoming appointments in the next {label} for {salon.name}:"]
                for appointment in appointments:
                    local_time = appointment.appointment_at.astimezone(ZoneInfo(salon.timezone))
                    customer_name = appointment.customer.display_name if appointment.customer else "Guest"
                    lines.append(
                        f"- {local_time.strftime('%I:%M %p')} | {appointment.service_name_snapshot} | {customer_name} | {appointment.booking_reference}"
                    )
                message_text = "\n".join(lines)

                for contact in contacts:
                    channel_config = self.tenant_service.get_channel_config(salon, contact.channel)
                    if not channel_config:
                        continue
                    deliveries = await self.dispatcher.send_instruction(
                        channel_config=channel_config,
                        destination=contact.destination,
                        instruction=OutboundInstruction(text=message_text),
                    )
                    for delivery in deliveries:
                        self.db.add(
                            OutboundMessage(
                                salon_id=salon.id,
                                customer_id=None,
                                channel=contact.channel,
                                destination=contact.destination,
                                text=delivery.text,
                                provider_message_id=delivery.provider_message_id,
                                payload=delivery.payload,
                            )
                        )

                for job in job_group:
                    await self._mark_job_sent(job)
                processed += len(job_group)
            except Exception as exc:  # noqa: BLE001
                for job in job_group:
                    await self._mark_job_failed(job, str(exc))
                processed += len(job_group)
        return processed

    async def _send_customer_reminder(self, job: NotificationJob, appointment: Appointment) -> None:
        if appointment.status != AppointmentStatus.CONFIRMED:
            return

        salon = await self.tenant_service.get_salon_by_id(appointment.salon_id)
        if not salon or not appointment.customer:
            return

        channel_config = self.tenant_service.get_channel_config(salon, appointment.channel)
        destination = self._customer_destination(appointment)
        if not channel_config or not destination:
            raise ValueError("Missing channel configuration or destination for customer reminder.")

        lead_label = "1 hour" if job.job_type == NotificationJobType.CUSTOMER_REMINDER_60 else "15 minutes"
        local_time = appointment.appointment_at.astimezone(ZoneInfo(salon.timezone))
        message_text = (
            f"Reminder: your appointment at {salon.name} is in {lead_label}.\n"
            f"Booking reference: {appointment.booking_reference}\n"
            f"Service: {appointment.service_name_snapshot}\n"
            f"Date: {local_time.strftime('%d %b %Y')}\n"
            f"Time: {local_time.strftime('%I:%M %p')}"
        )
        localized_text = await self.llm_service.localize_text(message_text, appointment.language)
        deliveries = await self.dispatcher.send_instruction(
            channel_config=channel_config,
            destination=destination,
            instruction=OutboundInstruction(text=localized_text),
        )
        for delivery in deliveries:
            self.db.add(
                OutboundMessage(
                    salon_id=salon.id,
                    customer_id=appointment.customer_id,
                    channel=appointment.channel,
                    destination=destination,
                    text=delivery.text,
                    provider_message_id=delivery.provider_message_id,
                    payload=delivery.payload,
                )
            )

    async def _send_customer_cancellation(self, job: NotificationJob, appointment: Appointment) -> None:
        salon = await self.tenant_service.get_salon_by_id(appointment.salon_id)
        if not salon or not appointment.customer:
            return

        channel_config = self.tenant_service.get_channel_config(salon, appointment.channel)
        destination = self._customer_destination(appointment)
        if not channel_config or not destination:
            raise ValueError("Missing channel configuration or destination for cancellation notice.")

        local_time = appointment.appointment_at.astimezone(ZoneInfo(salon.timezone))
        message_text = (
            f"Your appointment at {salon.name} has been cancelled.\n"
            f"Booking reference: {appointment.booking_reference}\n"
            f"Service: {appointment.service_name_snapshot}\n"
            f"Date: {local_time.strftime('%d %b %Y')}\n"
            f"Time: {local_time.strftime('%I:%M %p')}"
        )
        if appointment.cancellation_reason:
            message_text += f"\nReason: {appointment.cancellation_reason}"
        localized_text = await self.llm_service.localize_text(message_text, appointment.language)
        deliveries = await self.dispatcher.send_instruction(
            channel_config=channel_config,
            destination=destination,
            instruction=OutboundInstruction(text=localized_text),
        )
        for delivery in deliveries:
            self.db.add(
                OutboundMessage(
                    salon_id=salon.id,
                    customer_id=appointment.customer_id,
                    channel=appointment.channel,
                    destination=destination,
                    text=delivery.text,
                    provider_message_id=delivery.provider_message_id,
                    payload=delivery.payload,
                )
            )

    async def _load_appointment(self, appointment_id) -> Appointment | None:
        statement = (
            select(Appointment)
            .options(joinedload(Appointment.customer), joinedload(Appointment.service), joinedload(Appointment.salon))
            .where(Appointment.id == appointment_id)
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    @staticmethod
    def _customer_destination(appointment: Appointment) -> str | None:
        if not appointment.customer:
            return None
        if appointment.channel.value == "whatsapp":
            return appointment.customer.phone_number or appointment.customer.external_user_id
        if appointment.channel.value == "telegram":
            return appointment.customer.telegram_chat_id or appointment.customer.external_user_id
        return appointment.customer.external_user_id

    async def _mark_job_sent(self, job: NotificationJob) -> None:
        job.status = NotificationJobStatus.SENT
        job.sent_at = utc_now()
        job.last_error = None
        await self.db.commit()

    async def _mark_job_failed(self, job: NotificationJob, error_message: str) -> None:
        job.status = NotificationJobStatus.FAILED
        job.last_error = error_message[:1000]
        await self.db.commit()
