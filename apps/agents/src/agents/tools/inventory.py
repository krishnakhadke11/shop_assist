import logging
from typing import Any

from livekit.agents import function_tool

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)


@function_tool
async def check_inventory(product_id: int, quantity: int = 1) -> dict[str, Any]:
    """Check whether a product has sufficient available inventory (inventory - reserved)."""
    logger.info(
        "[TOOL: check_inventory] Checking product_id=%d for requested_quantity=%d",
        product_id,
        quantity,
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    id,
                    name,
                    (inventory_quantity - reserved_quantity) AS available_quantity
                FROM products
                WHERE id = %s
                """,
                (product_id,),
            )
            row = await cursor.fetchone()
            if not row:
                logger.warning("[TOOL: check_inventory] Product ID %d not found", product_id)
                return {
                    "product_id": product_id,
                    "available": False,
                    "error": "Product not found",
                }

            available_qty = int(row["available_quantity"])
            is_available = available_qty >= quantity
            logger.info(
                "[TOOL: check_inventory] Product %r (ID: %d): available_qty=%d, requested_qty=%d, in_stock=%s",
                row["name"],
                product_id,
                available_qty,
                quantity,
                is_available,
            )
            return {
                "product_id": product_id,
                "name": row["name"],
                "requested_quantity": quantity,
                "available_quantity": available_qty,
                "available": is_available,
            }


@function_tool
async def reserve_inventory(order_id: str, product_id: int, quantity: int) -> dict[str, Any]:
    """Atomically reserve inventory for an order if sufficient stock is available."""
    logger.info(
        "[TOOL: reserve_inventory] Request to reserve product_id=%d, quantity=%d for order_id=%r",
        product_id,
        quantity,
        order_id,
    )
    if quantity <= 0:
        logger.error(
            "[TOOL: reserve_inventory] Invalid quantity %d for order_id=%r", quantity, order_id
        )
        return {"success": False, "error": "Quantity must be positive"}

    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            # Check availability with FOR UPDATE row lock to prevent race conditions
            await cursor.execute(
                """
                SELECT
                    id,
                    name,
                    (inventory_quantity - reserved_quantity) AS available_quantity
                FROM products
                WHERE id = %s
                FOR UPDATE
                """,
                (product_id,),
            )
            product = await cursor.fetchone()
            if not product:
                logger.warning("[TOOL: reserve_inventory] Product ID %d not found", product_id)
                return {"success": False, "error": "Product not found"}

            available_qty = int(product["available_quantity"])
            if available_qty < quantity:
                err_msg = (
                    f"Insufficient stock for {product['name']}. "
                    f"Available: {available_qty}, Requested: {quantity}"
                )
                logger.warning("[TOOL: reserve_inventory] Failed: %s", err_msg)
                return {
                    "success": False,
                    "error": err_msg,
                }

            # Increment reserved_quantity
            await cursor.execute(
                """
                UPDATE products
                SET reserved_quantity = reserved_quantity + %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (quantity, product_id),
            )

            # Insert or update inventory reservation record
            await cursor.execute(
                """
                INSERT INTO inventory_reservations (order_id, product_id, quantity, status)
                VALUES (%s, %s, %s, 'RESERVED')
                ON CONFLICT (order_id, product_id)
                DO UPDATE SET
                    quantity = inventory_reservations.quantity + EXCLUDED.quantity,
                    status = 'RESERVED'
                """,
                (order_id, product_id, quantity),
            )
            await connection.commit()

            logger.info(
                "[TOOL: reserve_inventory] Successfully reserved %d unit(s) of %r for order_id=%r",
                quantity,
                product["name"],
                order_id,
            )
            return {
                "success": True,
                "order_id": order_id,
                "product_id": product_id,
                "product_name": product["name"],
                "reserved_quantity": quantity,
            }


@function_tool
async def release_inventory_reservation(order_id: str, product_id: int) -> dict[str, Any]:
    """Release a previous inventory reservation and adjust reserved_quantity."""
    logger.info(
        "[TOOL: release_inventory_reservation] Releasing reservation for order_id=%r, product_id=%d",
        order_id,
        product_id,
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT id, quantity, status
                FROM inventory_reservations
                WHERE order_id = %s AND product_id = %s AND status = 'RESERVED'
                FOR UPDATE
                """,
                (order_id, product_id),
            )
            res = await cursor.fetchone()
            if not res:
                logger.warning(
                    "[TOOL: release_inventory_reservation] No active RESERVED record for order_id=%r, product_id=%d",
                    order_id,
                    product_id,
                )
                return {
                    "success": False,
                    "order_id": order_id,
                    "product_id": product_id,
                    "error": "No active reservation found",
                }

            qty = int(res["quantity"])

            await cursor.execute(
                """
                UPDATE products
                SET reserved_quantity = GREATEST(0, reserved_quantity - %s),
                    updated_at = NOW()
                WHERE id = %s
                """,
                (qty, product_id),
            )

            await cursor.execute(
                """
                UPDATE inventory_reservations
                SET status = 'RELEASED',
                    released_at = NOW()
                WHERE id = %s
                """,
                (res["id"],),
            )

            await connection.commit()
            logger.info(
                "[TOOL: release_inventory_reservation] Released %d reserved unit(s) for order_id=%r, product_id=%d",
                qty,
                order_id,
                product_id,
            )
            return {
                "success": True,
                "order_id": order_id,
                "product_id": product_id,
                "released_quantity": qty,
            }
