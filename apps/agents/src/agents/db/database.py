import logging

from psycopg import AsyncConnection, sql

from agents.config import settings
from agents.db.connection import get_database_url

logger = logging.getLogger(__name__)


async def ensure_database_exists() -> None:
    """Connect to default 'postgres' database and create target database if it doesn't exist."""
    target_db = settings.POSTGRES_DB
    if target_db == "postgres":
        return

    postgres_url = get_database_url("postgres")
    try:
        async with await AsyncConnection.connect(postgres_url, autocommit=True) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT 1 FROM pg_database WHERE datname = %s",
                    (target_db,),
                )
                exists = await cur.fetchone()
                if not exists:
                    logger.info("Database '%s' does not exist. Creating it...", target_db)
                    await cur.execute(
                        sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target_db))
                    )
                    logger.info("Database '%s' created successfully.", target_db)
                else:
                    logger.debug("Database '%s' already exists.", target_db)
    except Exception as e:
        logger.warning(
            "Could not verify/create database '%s' via maintenance 'postgres' db: %s. "
            "Proceeding assuming database already exists.",
            target_db,
            e,
        )
