from __future__ import annotations

import warnings
from functools import lru_cache
from typing import Optional

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application Settings
    app_name: str = Field(default="Beauty Parlour Bot", validation_alias=AliasChoices("APP_NAME"))
    api_prefix: str = Field(default="/api/v1", validation_alias=AliasChoices("API_PREFIX"))
    environment: str = Field(default="development", validation_alias=AliasChoices("ENVIRONMENT"))
    debug: bool = Field(default=False, validation_alias=AliasChoices("APP_DEBUG"))

    # Database - Required but with safe default for development
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/beauty_parlour",
        validation_alias=AliasChoices("DATABASE_URL"),
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias=AliasChoices("REDIS_URL"),
    )

    # LLM Configuration
    groq_api_key: Optional[str] = Field(default=None, validation_alias=AliasChoices("GROQ_API_KEY"))
    groq_model: str = Field(default="llama-3.3-70b-versatile", validation_alias=AliasChoices("GROQ_MODEL"))
    groq_base_url: str = Field(
        default="https://api.groq.com/openai/v1",
        validation_alias=AliasChoices("GROQ_BASE_URL"),
    )

    # Server Configuration
    app_host: str = Field(default="0.0.0.0", validation_alias=AliasChoices("APP_HOST"))
    app_port: int = Field(default=8000, ge=1, le=65535, validation_alias=AliasChoices("APP_PORT"))
    app_workers: int = Field(default=1, ge=1, validation_alias=AliasChoices("APP_WORKERS"))
    notification_workers: int = Field(default=1, ge=1, validation_alias=AliasChoices("NOTIFICATION_WORKERS"))
    redis_ttl_seconds: int = Field(default=86400, ge=1, validation_alias=AliasChoices("REDIS_TTL_SECONDS"))
    session_ttl_seconds: int = Field(default=86400, ge=1, validation_alias=AliasChoices("SESSION_TTL_SECONDS"))

    # Telegram Configuration
    # Note: Bot tokens are stored per-salon in SalonChannel.provider_config["bot_token"].
    # There is no global fallback token — every salon must have its token configured in the DB.
    telegram_bot_name: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("TELEGRAM_BOT_NAME"),
    )

    # WhatsApp Configuration
    whatsapp_access_token: Optional[str] = Field(default=None, validation_alias=AliasChoices("WHATSAPP_ACCESS_TOKEN"))
    whatsapp_phone_number_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("WHATSAPP_PHONE_NUMBER_ID"),
    )
    whatsapp_verify_token: str = Field(
        default="default_verify_token",
        validation_alias=AliasChoices("WHATSAPP_VERIFY_TOKEN"),
    )

    # Business Configuration
    webhook_base_url: str = Field(
        default="http://localhost:8000",
        validation_alias=AliasChoices("WEBHOOK_BASE_URL"),
    )
    default_salon_slug: str = Field(
        default="demo-beauty-palace",
        validation_alias=AliasChoices("DEFAULT_SALON_SLUG"),
    )
    default_timezone: str = Field(default="Asia/Kolkata", validation_alias=AliasChoices("DEFAULT_TIMEZONE"))
    max_sample_images: int = Field(default=5, ge=1, validation_alias=AliasChoices("MAX_SAMPLE_IMAGES"))
    notification_batch_size: int = Field(default=50, ge=1, validation_alias=AliasChoices("NOTIFICATION_BATCH_SIZE"))
    notification_poll_seconds: int = Field(
        default=30,
        ge=1,
        validation_alias=AliasChoices("NOTIFICATION_POLL_SECONDS"),
    )
    lifecycle_poll_seconds: int = Field(
        default=600,
        ge=60,
        validation_alias=AliasChoices("LIFECYCLE_POLL_SECONDS"),
    )
    
    # CORS Configuration (comma-separated origins)
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173",
        validation_alias=AliasChoices("CORS_ORIGINS"),
    )

    # Supabase Configuration
    supabase_url: str = Field(
        default="https://placeholder.supabase.co",
        validation_alias=AliasChoices("SUPABASE_URL"),
    )
    supabase_service_role_key: str = Field(
        default="your-supabase-service-role-key-here",
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY"),
    )
    supabase_jwt_secret: str = Field(
        default="your-supabase-jwt-secret-here",
        validation_alias=AliasChoices("SUPABASE_JWT_SECRET"),
    )

    # Email Configuration
    email_smtp_host: str = Field(default="", validation_alias=AliasChoices("EMAIL_SMTP_HOST"))
    email_smtp_port: int = Field(default=587, validation_alias=AliasChoices("EMAIL_SMTP_PORT"))
    email_smtp_user: str = Field(default="", validation_alias=AliasChoices("EMAIL_SMTP_USER"))
    email_smtp_password: str = Field(default="", validation_alias=AliasChoices("EMAIL_SMTP_PASSWORD"))
    email_from: str = Field(default="", validation_alias=AliasChoices("EMAIL_FROM"))
    salon_owner_email: str = Field(default="", validation_alias=AliasChoices("SALON_OWNER_EMAIL"))

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or "YOUR_DATABASE_PASSWORD" in v or "YOUR_" in v:
            warnings.warn(
                "DATABASE_URL contains placeholder values. Please update .env with actual credentials. "
                "The application may fail to connect to the database.",
                UserWarning,
                stacklevel=2,
            )
        return v

    @field_validator("groq_api_key")
    @classmethod
    def validate_groq_key(cls, v: Optional[str]) -> Optional[str]:
        if v and ("your_" in v.lower() or "placeholder" in v.lower()):
            warnings.warn(
                "GROQ_API_KEY appears to be a placeholder. LLM features will be disabled.",
                UserWarning,
                stacklevel=2,
            )
            return None
        return v

    @property
    def llm_api_key(self) -> Optional[str]:
        return self.groq_api_key

    @property
    def llm_model(self) -> str:
        return self.groq_model

    @property
    def llm_base_url(self) -> Optional[str]:
        return self.groq_base_url

    @property
    def effective_session_ttl_seconds(self) -> int:
        return self.session_ttl_seconds

    def validate_required_services(self) -> list[str]:
        """Validate that required external services are configured."""
        missing = []
        if "YOUR_" in self.database_url or not self.database_url:
            missing.append("DATABASE_URL")
        if "YOUR_" in self.redis_url or not self.redis_url:
            missing.append("REDIS_URL")
        return missing


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
