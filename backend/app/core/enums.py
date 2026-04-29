from __future__ import annotations

from enum import Enum


class ChannelType(str, Enum):
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"


class UserRole(str, Enum):
    ADMIN = "admin"
    SALON_OWNER = "salon_owner"
    RECEPTION = "reception"


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    CANCELLED_BY_CLIENT = "cancelled_by_client"
    # NOTE: ensure "cancelled_by_user" is added to appointment_status enum in migration SQL
    CANCELLED_BY_USER = "cancelled_by_user"
    CANCELLED_BY_SALON = "cancelled_by_salon"
    CANCELLED_BY_RECEPTION = "cancelled_by_reception"
    CANCELLED_CLOSURE = "cancelled_closure"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class UserIntent(str, Enum):
    NEW_BOOKING = "new_booking"
    MANAGE_BOOKING = "manage_booking"


class ConversationStep(str, Enum):
    GREETING = "greeting"
    MAIN_MENU = "main_menu"
    MANAGE_APPOINTMENT_MENU = "manage_appointment_menu"
    SELECT_APPOINTMENT = "select_appointment"  # New step for selecting which appointment to manage
    LANGUAGE = "language"
    CUSTOMER_NAME = "customer_name"
    MARRIAGE_TYPE = "marriage_type"
    SERVICE = "service"
    SAMPLE_IMAGES = "sample_images"
    APPOINTMENT_DATE = "appointment_date"
    DATE_CONFIRMATION = "date_confirmation"
    APPOINTMENT_TIME = "appointment_time"
    TIME_CONFIRMATION = "time_confirmation"  # New step for time verification
    EMAIL = "email"
    PHONE_NUMBER = "phone_number"
    CONFIRMATION = "confirmation"
    COMPLETE = "complete"


class NotificationJobType(str, Enum):
    REMINDER_24H = "reminder_24h"
    REMINDER_1H = "reminder_1h"
    REMINDER_15M = "reminder_15m"
    REMINDER_7AM = "reminder_7am"          # Morning-of reminder at 07:00 salon local time
    SALON_DAILY_DIGEST = "salon_daily_digest"
    SALON_OPENING_DIGEST = "salon_opening_digest"
    SALON_PER_APPOINTMENT = "salon_per_appointment"
    CLOSURE_CANCELLATION = "closure_cancellation"
    # Legacy names for backwards compatibility
    CUSTOMER_REMINDER_60 = "reminder_1h"
    CUSTOMER_REMINDER_15 = "reminder_15m"
    SALON_DIGEST_60 = "salon_daily_digest"
    SALON_DIGEST_15 = "salon_opening_digest"
    CUSTOMER_CANCELLATION = "closure_cancellation"


class NotificationJobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"
    SKIPPED = "skipped"


class DigestPreference(str, Enum):
    DAILY = "daily"
    OPENING = "opening"
    PER_APPOINTMENT = "per_appointment"
