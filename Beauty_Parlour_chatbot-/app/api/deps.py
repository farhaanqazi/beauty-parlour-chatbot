from __future__ import annotations
import asyncio
from collections.abc import AsyncIterator
from functools import partial
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import create_client

from app.core.config import Settings, get_settings
from app.db.models.user import User
from app.db.session import SessionLocal
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.redis.state_store import RedisStateStore
from app.services.conversation_service import ConversationService
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService
from app.utils.logger import app_logger


# Security scheme for Bearer token
security = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    """Represents an authenticated user from JWT token."""

    def __init__(
        self,
        id: str,
        email: str,
        role: str,
        salon_id: Optional[str] = None,
        is_active: bool = True,
    ):
        self.id = id
        self.email = email
        self.role = role
        self.salon_id = salon_id
        self.is_active = is_active

    def __repr__(self) -> str:
        return f"AuthenticatedUser(id={self.id}, email={self.email}, role={self.role})"


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def get_app_settings() -> Settings:
    return get_settings()


def get_state_store(request: Request) -> RedisStateStore:
    return request.app.state.state_store


def get_llm_service(request: Request) -> LLMService:
    return request.app.state.llm_service


def get_dispatcher(request: Request) -> MessageDispatcher:
    return request.app.state.dispatcher


def get_email_service(request: Request) -> EmailService | None:
    return request.app.state.email_service


def get_conversation_service(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> ConversationService:
    return ConversationService(
        db=db,
        settings=settings,
        state_store=get_state_store(request),
        llm_service=get_llm_service(request),
        dispatcher=get_dispatcher(request),
        email_service=get_email_service(request),
    )


def get_notification_service(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> NotificationService:
    return NotificationService(
        db=db,
        dispatcher=get_dispatcher(request),
        llm_service=get_llm_service(request),
        batch_size=settings.notification_batch_size,
    )


# ============================================================================
# JWT Authentication Dependencies
# ============================================================================

# Supabase admin client — created lazily and reused
_supabase_admin = None


def _get_supabase_admin() -> "create_client":
    """Return a cached Supabase admin client using the service_role key."""
    global _supabase_admin
    if _supabase_admin is None:
        settings = get_settings()
        _supabase_admin = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        app_logger.info(
            "Supabase admin client initialized",
            event="auth_admin_client_initialized",
        )
    return _supabase_admin


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedUser:
    """
    JWT Authentication Dependency.

    Validates Bearer token using the Supabase Admin SDK, which handles
    both HS256 and ES256 tokens automatically — no manual JWKS needed.

    Raises:
        HTTPException 401: Missing authentication credentials
        HTTPException 401: Invalid or expired token
        HTTPException 403: User not found or inactive
    """
    if not credentials:
        app_logger.warn(
            "Missing authentication credentials",
            event="auth_failure",
            error_type="missing_credentials",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    admin = _get_supabase_admin()

    try:
        app_logger.info(
            "Authentication attempt",
            event="auth_attempt",
            auth_scheme="bearer",
        )
        # admin.auth.get_user() is synchronous (makes an HTTP request to Supabase).
        # Run it in a thread pool so it does not block the async event loop.
        loop = asyncio.get_event_loop()
        auth_user = await loop.run_in_executor(None, partial(admin.auth.get_user, token))
        user_id = auth_user.user.id

    except Exception as e:
        app_logger.warn(
            "Token verification failed",
            event="auth_failure",
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from local database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        app_logger.warn(
            "Authentication failed: user not found",
            event="auth_failure",
            error_type="user_not_found",
            user_id=user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not found",
        )

    if not user.is_active:
        app_logger.warn(
            "Authentication failed: user inactive",
            event="auth_failure",
            error_type="user_inactive",
            user_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    app_logger.info(
        "Authentication success",
        event="auth_success",
        user_id=user.id,
        role=user.role.value,
        salon_id=str(user.salon_id) if user.salon_id else None,
    )
    return AuthenticatedUser(
        id=user.id,
        email=user.email,
        role=user.role.value,  # Convert UserRole enum to string value
        salon_id=str(user.salon_id) if user.salon_id else None,
        is_active=user.is_active,
    )


def require_roles(*roles: str):
    """
    Role-based Authorization Dependency Factory.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: AuthenticatedUser = Depends(require_roles("admin"))):
            ...

        @router.get("/staff-only")
        async def staff_endpoint(user: AuthenticatedUser = Depends(require_roles("admin", "salon_owner"))):
            ...

    Raises:
        HTTPException 403: User role not in allowed roles
    """
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(roles)}",
            )
        return user
    return role_checker


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[AuthenticatedUser]:
    """
    Get current user if authenticated, otherwise return None.

    Use this for endpoints that work for both authenticated and anonymous users.
    """
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


async def require_role(
    required_role: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """
    Dependency factory to require a specific user role.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: AuthenticatedUser = Depends(require_role("admin"))):
            ...

    Raises:
        HTTPException 403: User role does not match required role
    """
    if user.role != required_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required role: {required_role}",
        )
    return user


async def require_any_role(
    *roles: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """
    Dependency factory to require any of the specified roles.

    Usage:
        @router.get("/staff-only")
        async def staff_endpoint(user: AuthenticatedUser = Depends(require_any_role("admin", "salon_owner"))):
            ...

    Raises:
        HTTPException 403: User role not in allowed roles
    """
    if user.role not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required roles: {', '.join(roles)}",
        )
    return user


# Exports
__all__ = [
    # Database & Services
    "get_db",
    "get_app_settings",
    "get_state_store",
    "get_llm_service",
    "get_dispatcher",
    "get_conversation_service",
    "get_notification_service",
    # JWT Authentication
    "AuthenticatedUser",
    "security",
    "get_current_user",
    "get_optional_user",
    "require_role",
    "require_any_role",
    "require_roles",
]
