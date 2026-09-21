from typing import Any, cast

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from agents.config import settings


def get_database_url(db_name: str | None = None) -> str:
    db = db_name if db_name is not None else settings.POSTGRES_DB
    password = f":{settings.POSTGRES_PASSWORD}" if settings.POSTGRES_PASSWORD else ""

    return (
        f"postgresql://{settings.POSTGRES_USER}{password}@"
        f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{db}"
    )


DATABASE_URL = get_database_url()


async def get_connection(
    db_name: str | None = None,
) -> AsyncConnection[dict[str, Any]]:
    connection = await AsyncConnection.connect(
        get_database_url(db_name),
        row_factory=dict_row,
    )

    return cast(AsyncConnection[dict[str, Any]], connection)