import asyncio
import logging
import sys

from agents.db import initialize_database
from agents.voice.livekit_agent import run_agent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def startup() -> None:
    """Unified entry point for Shop Assist Agent: initializes database and runs LiveKit worker."""
    logger.info("Initializing database...")
    asyncio.run(initialize_database())
    logger.info("Database initialized successfully.")

    if "--init-db-only" in sys.argv:
        logger.info("Database initialization completed. Exiting as --init-db-only was specified.")
        return

    logger.info("Starting LiveKit agent worker...")
    try:
        run_agent()
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    startup()
