import logging
from decimal import Decimal
from typing import Any

from livekit.agents import function_tool

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)


@function_tool
async def create_order(
    order_id: str,
    customer_id: int,
    items: list[dict[str, Any]],
    delivery_address_id: int | None = None,
    status: str = "PENDING",
) -> dict[str, Any]:
    """Create a new customer order with line items and inventory reservations atomically."""
    logger.info(
        "[TOOL: create_order] Creating order_id=%r for customer_id=%d with %d item(s), delivery_address_id=%s, status=%s",
        order_id,
        customer_id,
        len(items) if items else 0,
        delivery_address_id,
        status,
    )
    if not items:
        logger.error("[TOOL: create_order] Failed: Order must contain at least one item")
        raise ValueError("Order must contain at least one item")

    total_amount = Decimal("0.00")
    formatted_items: list[dict[str, Any]] = []
    for item in items:
        item_prod_id = int(item["product_id"])
        item_qty = int(item.get("quantity", 1))
        item_unit_price = float(Decimal(str(item.get("unit_price", 0))))
        item_subtotal = round(item_qty * item_unit_price, 2)
        total_amount += Decimal(str(item_subtotal))
        formatted_items.append(
            {
                "product_id": item_prod_id,
                "quantity": item_qty,
                "unit_price": item_unit_price,
                "subtotal": item_subtotal,
            }
        )

    logger.info(
        "[TOOL: create_order] Calculated total amount for order %r: ₹%s", order_id, total_amount
    )

    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            # 1. Insert order
            await cursor.execute(
                """
                INSERT INTO orders (id, customer_id, status, delivery_address_id, total_amount)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (order_id, customer_id, status, delivery_address_id, float(total_amount)),
            )

            # 2. Insert line items & reserve inventory
            for line_item in formatted_items:
                line_prod_id: int = int(line_item["product_id"])
                line_qty: int = int(line_item["quantity"])
                line_unit_price: float = float(line_item["unit_price"])

                await cursor.execute(
                    """
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (order_id, line_prod_id, line_qty, line_unit_price),
                )

                # Update product reserved quantity
                await cursor.execute(
                    """
                    UPDATE products
                    SET reserved_quantity = reserved_quantity + %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (line_qty, line_prod_id),
                )

                # Record inventory reservation
                await cursor.execute(
                    """
                    INSERT INTO inventory_reservations (order_id, product_id, quantity, status)
                    VALUES (%s, %s, %s, 'RESERVED')
                    ON CONFLICT (order_id, product_id)
                    DO UPDATE SET quantity = inventory_reservations.quantity + EXCLUDED.quantity
                    """,
                    (order_id, line_prod_id, line_qty),
                )

            await connection.commit()

            result = {
                "order_id": order_id,
                "id": order_id,
                "customer_id": customer_id,
                "status": status,
                "total_amount": float(total_amount),
                "delivery_address_id": delivery_address_id,
                "items": formatted_items,
            }
            logger.info(
                "[TOOL: create_order] Order %r placed successfully: Total=₹%.2f, %d item(s)",
                order_id,
                result["total_amount"],
                len(formatted_items),
            )
            return result


@function_tool
async def get_order(order_id: str) -> dict[str, Any] | None:
    """Retrieve an order and its line items by order ID."""
    logger.info("[TOOL: get_order] Retrieving order details for order_id=%r", order_id)
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    o.id,
                    o.customer_id,
                    c.name AS customer_name,
                    c.phone AS customer_phone,
                    o.status,
                    o.delivery_address_id,
                    o.total_amount
                FROM orders o
                LEFT JOIN customers c ON c.id = o.customer_id
                WHERE o.id = %s
                """,
                (order_id,),
            )
            order_row = await cursor.fetchone()
            if not order_row:
                logger.warning("[TOOL: get_order] Order %r not found", order_id)
                return None

            await cursor.execute(
                """
                SELECT
                    oi.product_id,
                    p.name AS product_name,
                    oi.quantity,
                    oi.unit_price,
                    (oi.quantity * oi.unit_price) AS subtotal
                FROM order_items oi
                JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = %s
                ORDER BY oi.id ASC
                """,
                (order_id,),
            )
            items = await cursor.fetchall()

            order_dict = {
                "order_id": str(order_row["id"]),
                "id": str(order_row["id"]),
                "customer_id": int(order_row["customer_id"]),
                "customer_name": order_row["customer_name"],
                "customer_phone": order_row["customer_phone"],
                "status": str(order_row["status"]),
                "total_amount": float(order_row["total_amount"]),
                "delivery_address_id": order_row["delivery_address_id"],
                "items": [
                    {
                        "product_id": int(it["product_id"]),
                        "product_name": str(it["product_name"]),
                        "quantity": int(it["quantity"]),
                        "unit_price": float(it["unit_price"]),
                        "subtotal": float(it["subtotal"]),
                    }
                    for it in items
                ],
            }
            logger.info(
                "[TOOL: get_order] Order %r: Status=%s, Customer=%r (%s), Total=₹%.2f, %d line item(s)",
                order_id,
                order_dict["status"],
                order_dict.get("customer_name"),
                order_dict.get("customer_phone"),
                order_dict["total_amount"],
                len(order_dict["items"]),
            )
            return order_dict


@function_tool
async def update_order_status(order_id: str, status: str) -> dict[str, Any] | None:
    """Update order status (e.g. PENDING, CONFIRMED, DELIVERED, CANCELLED)."""
    norm_status = status.strip().upper()
    logger.info(
        "[TOOL: update_order_status] Updating order_id=%r to status=%s", order_id, norm_status
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                UPDATE orders
                SET status = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id, customer_id, status, total_amount
                """,
                (norm_status, order_id),
            )
            row = await cursor.fetchone()
            await connection.commit()
            if row:
                res = {
                    "order_id": str(row["id"]),
                    "id": str(row["id"]),
                    "status": str(row["status"]),
                    "total_amount": float(row["total_amount"]),
                }
                logger.info(
                    "[TOOL: update_order_status] Order %r successfully updated to status=%s",
                    order_id,
                    res["status"],
                )
                return res
            logger.warning(
                "[TOOL: update_order_status] Order %r not found for status update", order_id
            )
            return None


@function_tool
async def list_customer_orders(customer_id: int, limit: int = 10) -> list[dict[str, Any]]:
    """List recent orders for a given customer."""
    logger.info(
        "[TOOL: list_customer_orders] Listing up to %d orders for customer_id=%d",
        limit,
        customer_id,
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT id, customer_id, status, delivery_address_id, total_amount
                FROM orders
                WHERE customer_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (customer_id, limit),
            )
            rows = await cursor.fetchall()
            results = [
                {
                    "order_id": str(r["id"]),
                    "id": str(r["id"]),
                    "status": str(r["status"]),
                    "total_amount": float(r["total_amount"]),
                    "delivery_address_id": r["delivery_address_id"],
                }
                for r in rows
            ]
            logger.info(
                "[TOOL: list_customer_orders] Found %d order(s) for customer_id=%d",
                len(results),
                customer_id,
            )
            return results
