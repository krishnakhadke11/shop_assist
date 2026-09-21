import logging
from typing import Any

from livekit.agents import function_tool

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)


def _format_address(row: dict[str, Any]) -> dict[str, Any]:
    """Format delivery address row into clean, essential fields for the agent."""
    return {
        "address_id": int(row["id"]),
        "id": int(row["id"]),
        "customer_id": int(row["customer_id"]),
        "address_line1": str(row["address_line1"]),
        "address_line2": row["address_line2"],
        "landmark": row["landmark"],
        "city": str(row["city"]),
        "state": str(row["state"]),
        "pincode": str(row["pincode"]),
        "is_default": bool(row["is_default"]),
    }


@function_tool
async def add_customer_address(
    customer_id: int,
    address_line1: str,
    address_line2: str | None = None,
    landmark: str | None = None,
    city: str = "Mumbai",
    state: str = "Maharashtra",
    pincode: str = "",
    is_default: bool = False,
) -> dict[str, Any]:
    """Add a delivery address for a customer."""
    logger.info(
        "[TOOL: add_customer_address] Adding address for customer_id=%d: %r, City=%r, Pincode=%r (is_default=%s)",
        customer_id,
        address_line1,
        city,
        pincode,
        is_default,
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            # If setting as default, unset previous default
            if is_default:
                await cursor.execute(
                    """
                    UPDATE addresses
                    SET is_default = FALSE, updated_at = NOW()
                    WHERE customer_id = %s
                    """,
                    (customer_id,),
                )

            await cursor.execute(
                """
                INSERT INTO addresses (
                    customer_id, address_line1, address_line2, landmark,
                    city, state, pincode, is_default
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, customer_id, address_line1, address_line2, landmark,
                          city, state, pincode, is_default
                """,
                (
                    customer_id,
                    address_line1,
                    address_line2,
                    landmark,
                    city,
                    state,
                    pincode,
                    is_default,
                ),
            )
            row = await cursor.fetchone()
            await connection.commit()
            if not row:
                raise RuntimeError("Failed to insert address")
            res = _format_address(row)
            logger.info(
                "[TOOL: add_customer_address] Address created: ID=%d for customer_id=%d",
                res["address_id"],
                customer_id,
            )
            return res


@function_tool
async def get_customer_addresses(customer_id: int) -> list[dict[str, Any]]:
    """Retrieve all saved addresses for a customer."""
    logger.info("[TOOL: get_customer_addresses] Fetching addresses for customer_id=%d", customer_id)
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    id, customer_id, address_line1, address_line2, landmark,
                    city, state, pincode, is_default
                FROM addresses
                WHERE customer_id = %s
                ORDER BY is_default DESC, created_at DESC
                """,
                (customer_id,),
            )
            rows = await cursor.fetchall()
            results = [_format_address(row) for row in rows]
            logger.info(
                "[TOOL: get_customer_addresses] Found %d address(es) for customer_id=%d",
                len(results),
                customer_id,
            )
            return results


@function_tool
async def get_default_address(customer_id: int) -> dict[str, Any] | None:
    """Retrieve customer's default delivery address."""
    logger.info(
        "[TOOL: get_default_address] Getting default address for customer_id=%d", customer_id
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    id, customer_id, address_line1, address_line2, landmark,
                    city, state, pincode, is_default
                FROM addresses
                WHERE customer_id = %s AND is_default = TRUE
                LIMIT 1
                """,
                (customer_id,),
            )
            row = await cursor.fetchone()
            if row:
                res = _format_address(row)
                logger.info(
                    "[TOOL: get_default_address] Found default address ID=%d for customer_id=%d",
                    res["address_id"],
                    customer_id,
                )
                return res

            # Fallback to the latest address if no explicit default
            await cursor.execute(
                """
                SELECT
                    id, customer_id, address_line1, address_line2, landmark,
                    city, state, pincode, is_default
                FROM addresses
                WHERE customer_id = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (customer_id,),
            )
            fallback = await cursor.fetchone()
            if fallback:
                res = _format_address(fallback)
                logger.info(
                    "[TOOL: get_default_address] Fallback to latest address ID=%d for customer_id=%d",
                    res["address_id"],
                    customer_id,
                )
                return res
            logger.info(
                "[TOOL: get_default_address] No address found for customer_id=%d", customer_id
            )
            return None
