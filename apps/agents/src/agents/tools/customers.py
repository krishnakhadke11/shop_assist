import logging
from typing import Any

from livekit.agents import function_tool

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)


def _format_customer(row: dict[str, Any]) -> dict[str, Any]:
    """Format customer row into clean, essential fields for the agent."""
    return {
        "customer_id": int(row["id"]),
        "id": int(row["id"]),
        "name": str(row["name"]),
        "phone": str(row["phone"]),
    }


@function_tool
async def get_customer_by_phone(phone: str) -> dict[str, Any] | None:
    """Look up an existing customer by phone number."""
    cleaned_phone = phone.strip()
    logger.info("[TOOL: get_customer_by_phone] Looking up customer by phone %r", cleaned_phone)
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT id, name, phone
                FROM customers
                WHERE phone = %s
                """,
                (cleaned_phone,),
            )
            row = await cursor.fetchone()
            if row:
                res = _format_customer(row)
                logger.info(
                    "[TOOL: get_customer_by_phone] Customer found: ID=%d, Name=%r, Phone=%s",
                    res["customer_id"],
                    res["name"],
                    res["phone"],
                )
                return res
            logger.info(
                "[TOOL: get_customer_by_phone] No customer found with phone %r", cleaned_phone
            )
            return None


@function_tool
async def get_customer_by_id(customer_id: int) -> dict[str, Any] | None:
    """Look up a customer by customer ID."""
    logger.info("[TOOL: get_customer_by_id] Looking up customer ID %d", customer_id)
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT id, name, phone
                FROM customers
                WHERE id = %s
                """,
                (customer_id,),
            )
            row = await cursor.fetchone()
            if row:
                res = _format_customer(row)
                logger.info(
                    "[TOOL: get_customer_by_id] Customer ID %d found: Name=%r, Phone=%s",
                    customer_id,
                    res["name"],
                    res["phone"],
                )
                return res
            logger.warning("[TOOL: get_customer_by_id] Customer ID %d not found", customer_id)
            return None


@function_tool
async def create_customer(name: str, phone: str) -> dict[str, Any]:
    """Create a new customer profile."""
    cleaned_phone = phone.strip()
    cleaned_name = name.strip()
    logger.info(
        "[TOOL: create_customer] Creating new customer profile for Name=%r, Phone=%s",
        cleaned_name,
        cleaned_phone,
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO customers (name, phone)
                VALUES (%s, %s)
                RETURNING id, name, phone
                """,
                (cleaned_name, cleaned_phone),
            )
            row = await cursor.fetchone()
            await connection.commit()
            if not row:
                raise RuntimeError("Failed to create customer")
            res = _format_customer(row)
            logger.info(
                "[TOOL: create_customer] Customer created successfully: ID=%d, Name=%r, Phone=%s",
                res["customer_id"],
                res["name"],
                res["phone"],
            )
            return res


@function_tool
async def get_or_create_customer(phone: str, name: str = "Customer") -> dict[str, Any]:
    """Retrieve existing customer by phone or create new one if not found."""
    logger.info("[TOOL: get_or_create_customer] Initiating for Phone=%s, Name=%r", phone, name)
    existing = await get_customer_by_phone(phone)
    if existing:
        logger.info(
            "[TOOL: get_or_create_customer] Returning existing customer ID=%d",
            existing["customer_id"],
        )
        return existing

    logger.info("[TOOL: get_or_create_customer] Customer not found, creating new record...")
    return await create_customer(name=name, phone=phone)
