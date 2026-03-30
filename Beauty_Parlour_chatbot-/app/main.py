from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.db.session import db_session
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.redis.client import build_redis_client
from app.redis.state_store import RedisStateStore


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager for proper resource initialization and cleanup.
    
    Resources are initialized in order and cleaned up in reverse order on shutdown.
    If any initialization fails, already-initialized resources are properly cleaned up.
    """
    settings = get_settings()
    redis_client = None
    http_client = None
    initialized_resources: list[str] = []
    
    try:
        # Initialize resources in order
        redis_client = build_redis_client(settings.redis_url)
        initialized_resources.append("redis")
        
        http_client = httpx.AsyncClient(timeout=20.0)
        initialized_resources.append("http_client")
        
        # Initialize database session
        db_session.initialize(settings)
        initialized_resources.append("database")
        
        # Store in app state
        app.state.settings = settings
        app.state.redis_client = redis_client
        app.state.http_client = http_client
        app.state.state_store = RedisStateStore(redis_client, settings.effective_session_ttl_seconds)
        app.state.llm_service = LLMService(settings)
        app.state.dispatcher = MessageDispatcher(settings, http_client)
        
        # Log startup information
        logger.info(
            f"Application started: {settings.app_name} (env={settings.environment}, debug={settings.debug})"
        )
        
        yield
        
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        # Clean up any initialized resources on failure
        await _cleanup_resources(
            redis_client=redis_client if "redis" in initialized_resources else None,
            http_client=http_client if "http_client" in initialized_resources else None,
            cleanup_db="database" in initialized_resources,
        )
        raise
    else:
        # Clean up on normal shutdown
        await _cleanup_resources(
            redis_client=redis_client,
            http_client=http_client,
            cleanup_db=True,
        )


async def _cleanup_resources(
    redis_client: Any | None = None,
    http_client: Any | None = None,
    cleanup_db: bool = False,
) -> None:
    """Clean up application resources in reverse order."""
    errors: list[str] = []
    
    if http_client is not None:
        try:
            await http_client.aclose()
        except Exception as e:
            errors.append(f"HTTP client: {e}")
    
    if redis_client is not None:
        try:
            await redis_client.aclose()
        except Exception as e:
            errors.append(f"Redis client: {e}")
    
    if cleanup_db:
        try:
            await db_session.dispose()
        except Exception as e:
            errors.append(f"Database: {e}")
    
    if errors:
        logger.warning(f"Cleanup errors: {'; '.join(errors)}")


# Get settings early for app configuration
settings = get_settings()

# Configure CORS with environment-based origins
if settings.environment == "development":
    cors_origins = ["*"]
else:
    cors_origins = settings.cors_origins_list

app = FastAPI(
    title=settings.app_name,
    description="Beauty Parlour Appointment Booking Chatbot Backend",
    version="1.0.0",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """
    Health check endpoint.
    
    Returns application status and version information.
    """
    return {"status": "ok", "version": "1.0.0"}


@app.get("/health/ready", tags=["health"])
async def readiness_check() -> dict:
    """
    Readiness check endpoint.
    
    Verifies that all required services (database, Redis) are available.
    """
    from sqlalchemy import text
    
    status = {"status": "ok", "services": {}}
    
    # Check database
    try:
        async with db_session.session_factory() as session:
            await session.execute(text("SELECT 1"))
        status["services"]["database"] = "ok"
    except Exception as e:
        status["services"]["database"] = f"error: {e}"
        status["status"] = "degraded"
    
    # Check Redis
    try:
        redis_client = app.state.redis_client
        await redis_client.ping()
        status["services"]["redis"] = "ok"
    except Exception as e:
        status["services"]["redis"] = f"error: {e}"
        status["status"] = "degraded"
    
    return status


@app.get("/debug/db-url", tags=["debug"])
async def debug_db_url() -> dict:
    """Debug endpoint to verify database URL configuration."""
    from app.core.config import get_settings
    settings = get_settings()
    # Mask password in URL for security
    db_url = settings.database_url
    if "@" in db_url:
        parts = db_url.split("@")
        if "://" in parts[0]:
            protocol, creds = parts[0].split("://", 1)
            if ":" in creds:
                username = creds.split(":")[0]
                masked = f"{protocol}://{username}:***@{parts[1]}"
            else:
                masked = f"{protocol}://***@{parts[1]}"
        else:
            masked = "***"
    else:
        masked = "***"
    return {"db_url_masked": masked}
