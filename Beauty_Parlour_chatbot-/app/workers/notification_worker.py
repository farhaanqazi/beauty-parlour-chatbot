from __future__ import annotations

import asyncio
import logging
import signal
import sys
from typing import Any

import httpx

from app.core.config import get_settings
from app.db.session import db_session, SessionLocal
from app.llm.service import LLMService
from app.messaging.dispatcher import MessageDispatcher
from app.services.notification_service import NotificationService


logger = logging.getLogger(__name__)

# Graceful shutdown flag
shutdown_requested = False


def signal_handler(signum: int, frame: Any) -> None:
    """Handle shutdown signals gracefully."""
    global shutdown_requested
    shutdown_requested = True
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")


async def run_worker() -> None:
    """
    Run the notification worker with proper error handling and graceful shutdown.
    
    Features:
    - Exponential backoff on database connection failures
    - Graceful shutdown on SIGINT/SIGTERM
    - Comprehensive error logging
    - Resource cleanup on exit
    """
    settings = get_settings()
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    llm_service = LLMService(settings)
    http_client = None
    dispatcher = None
    consecutive_failures = 0
    max_backoff_seconds = 300  # 5 minutes max backoff
    base_backoff_seconds = 5
    
    try:
        http_client = httpx.AsyncClient(timeout=20.0)
        dispatcher = MessageDispatcher(settings, http_client)
        
        logger.info("Notification worker started")
        
        while not shutdown_requested:
            try:
                # Initialize database session if needed
                db_session.initialize(settings)
                
                async with SessionLocal() as db:
                    service = NotificationService(
                        db=db,
                        dispatcher=dispatcher,
                        llm_service=llm_service,
                        batch_size=settings.notification_batch_size,
                    )
                    processed = await service.run_once()
                    
                    if processed > 0:
                        logger.info(f"Processed {processed} notification jobs")
                    
                    # Reset backoff on success
                    consecutive_failures = 0
                    
            except Exception as e:
                consecutive_failures += 1
                logger.error(f"Worker iteration failed (attempt {consecutive_failures}): {e}")
                
                # Calculate backoff with exponential increase
                backoff = min(base_backoff_seconds * (2 ** (consecutive_failures - 1)), max_backoff_seconds)
                logger.info(f"Waiting {backoff}s before retry...")
                
                # Wait with ability to interrupt for shutdown
                await asyncio.sleep(backoff)
                continue
            
            # Normal poll interval between successful iterations
            await asyncio.sleep(settings.notification_poll_seconds)
            
    except Exception as e:
        logger.error(f"Worker crashed: {e}")
        raise
    finally:
        # Cleanup resources
        if http_client:
            await http_client.aclose()
        await db_session.dispose()
        logger.info("Notification worker shutdown complete")


def main() -> None:
    """Entry point for notification worker."""
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Worker exited with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
