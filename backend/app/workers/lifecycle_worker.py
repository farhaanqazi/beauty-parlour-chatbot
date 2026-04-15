from __future__ import annotations

import asyncio
import logging
import signal
import sys
from typing import Any

from app.core.config import get_settings
from app.db.session import db_session, SessionLocal
from app.services.lifecycle_service import LifecycleService


logger = logging.getLogger(__name__)

shutdown_requested = False


def signal_handler(signum: int, frame: Any) -> None:
    global shutdown_requested
    shutdown_requested = True
    logger.info(f"Lifecycle worker received signal {signum}, shutting down...")


async def run_worker() -> None:
    """
    Poll the database on a fixed interval and advance appointment statuses.

    Interval is controlled by LIFECYCLE_POLL_SECONDS (default 600 s / 10 min).
    Uses exponential back-off on repeated failures, capped at 5 minutes.
    """
    settings = get_settings()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    consecutive_failures = 0
    max_backoff_seconds = 300
    base_backoff_seconds = 5

    logger.info(
        f"Lifecycle worker started (poll_interval={settings.lifecycle_poll_seconds}s)"
    )

    while not shutdown_requested:
        try:
            db_session.initialize(settings)

            async with SessionLocal() as db:
                async with db.begin():
                    service = LifecycleService(db=db)
                    result = await service.run_once()

            if result.started or result.completed:
                logger.info(
                    f"Lifecycle tick: {result.started} started, {result.completed} completed"
                )

            consecutive_failures = 0

        except Exception as exc:
            consecutive_failures += 1
            logger.error(
                f"Lifecycle worker iteration failed (attempt {consecutive_failures}): {exc}"
            )
            backoff = min(
                base_backoff_seconds * (2 ** (consecutive_failures - 1)),
                max_backoff_seconds,
            )
            logger.info(f"Waiting {backoff}s before retry...")
            await asyncio.sleep(backoff)
            continue

        await asyncio.sleep(settings.lifecycle_poll_seconds)

    await db_session.dispose()
    logger.info("Lifecycle worker shutdown complete")


def main() -> None:
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Lifecycle worker interrupted by user")
        sys.exit(0)
    except Exception as exc:
        logger.error(f"Lifecycle worker exited with error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
