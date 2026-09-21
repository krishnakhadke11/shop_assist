import logging

from agents.db.connection import get_connection, get_database_url
from agents.db.database import ensure_database_exists
from agents.db.schema import initialize_schema
from agents.db.seed import seed_products

logger = logging.getLogger(__name__)


async def initialize_database() -> None:
    """Complete zero-manual-SQL database initialization: create DB, schema, and seed data."""
    logger.info("Verifying database existence...")
    await ensure_database_exists()

    logger.info("Initializing schema and indexes...")
    await initialize_schema()

    logger.info("Seeding initial data...")
    await seed_products()

    logger.info("Database initialization completed successfully.")


__all__ = [
    "initialize_database",
    "ensure_database_exists",
    "initialize_schema",
    "seed_products",
    "get_connection",
    "get_database_url",
]
