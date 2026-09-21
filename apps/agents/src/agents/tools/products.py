import logging
from typing import Any

from livekit.agents import function_tool

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)


def _format_product(row: dict[str, Any]) -> dict[str, Any]:
    """Format product row into clean, essential fields for the agent."""
    return {
        "product_id": int(row["id"]),
        "id": int(row["id"]),
        "name": str(row["name"]),
        "brand": row["brand"],
        "category": row["category"],
        "unit": str(row["unit"]),
        "pack_size": float(row["pack_size"]) if row["pack_size"] is not None else None,
        "price": float(row["price"]),
        "available_quantity": int(row["available_quantity"]),
    }


@function_tool
async def search_products(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Search products by name, brand, or alias using PostgreSQL pattern and trigram matching."""
    logger.info("[TOOL: search_products] Searching catalog with query=%r, limit=%d", query, limit)
    cleaned_query = query.strip()
    if not cleaned_query:
        logger.info("[TOOL: search_products] Empty query, returning empty list")
        return []

    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            # Match on name, brand, or alias array
            await cursor.execute(
                """
                SELECT
                    id,
                    name,
                    brand,
                    category,
                    unit,
                    pack_size,
                    price,
                    (inventory_quantity - reserved_quantity) AS available_quantity
                FROM products
                WHERE is_active = TRUE
                  AND (
                      name ILIKE %s
                      OR brand ILIKE %s
                      OR %s = ANY(aliases)
                      OR EXISTS (
                          SELECT 1 FROM unnest(aliases) alias
                          WHERE alias ILIKE %s
                      )
                  )
                ORDER BY
                    CASE WHEN name ILIKE %s THEN 0 ELSE 1 END,
                    name ASC
                LIMIT %s
                """,
                (
                    f"%{cleaned_query}%",
                    f"%{cleaned_query}%",
                    cleaned_query.lower(),
                    f"%{cleaned_query}%",
                    f"%{cleaned_query}%",
                    limit,
                ),
            )
            rows = await cursor.fetchall()
            results = [_format_product(row) for row in rows]
            logger.info(
                "[TOOL: search_products] Query %r returned %d product(s): %s",
                query,
                len(results),
                [
                    f"{p['name']} (ID: {p['product_id']}, Price: {p['price']}, Available: {p['available_quantity']})"
                    for p in results[:5]
                ],
            )
            return results


@function_tool
async def get_product_by_id(product_id: int) -> dict[str, Any] | None:
    """Retrieve a single product by ID."""
    logger.info("[TOOL: get_product_by_id] Looking up product ID %d", product_id)
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    id,
                    name,
                    brand,
                    category,
                    unit,
                    pack_size,
                    price,
                    (inventory_quantity - reserved_quantity) AS available_quantity
                FROM products
                WHERE id = %s
                """,
                (product_id,),
            )
            row = await cursor.fetchone()
            if row:
                res = _format_product(row)
                logger.info(
                    "[TOOL: get_product_by_id] Found product ID %d: %r (Price: %s, Available: %s)",
                    product_id,
                    res["name"],
                    res["price"],
                    res["available_quantity"],
                )
                return res
            logger.warning(
                "[TOOL: get_product_by_id] Product ID %d not found in database", product_id
            )
            return None


@function_tool
async def find_product_by_name(name: str) -> dict[str, Any] | None:
    """Find a product by exact or close name/alias match."""
    logger.info("[TOOL: find_product_by_name] Finding product by name %r", name)
    results = await search_products(query=name, limit=1)
    if results:
        res = results[0]
        logger.info(
            "[TOOL: find_product_by_name] Matched name %r -> %s (ID: %d)",
            name,
            res["name"],
            res["product_id"],
        )
        return res
    logger.warning("[TOOL: find_product_by_name] No product matched name %r", name)
    return None


@function_tool
async def list_active_products(
    category: str | None = None, limit: int = 50
) -> list[dict[str, Any]]:
    """List active products, optionally filtered by category."""
    logger.info(
        "[TOOL: list_active_products] Listing products (category=%r, limit=%d)", category, limit
    )
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            if category:
                await cursor.execute(
                    """
                    SELECT
                        id, name, brand, category, unit, pack_size, price,
                        (inventory_quantity - reserved_quantity) AS available_quantity
                    FROM products
                    WHERE is_active = TRUE AND category ILIKE %s
                    ORDER BY name ASC
                    LIMIT %s
                    """,
                    (category, limit),
                )
            else:
                await cursor.execute(
                    """
                    SELECT
                        id, name, brand, category, unit, pack_size, price,
                        (inventory_quantity - reserved_quantity) AS available_quantity
                    FROM products
                    WHERE is_active = TRUE
                    ORDER BY name ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
            rows = await cursor.fetchall()
            results = [_format_product(row) for row in rows]
            logger.info("[TOOL: list_active_products] Returning %d product(s)", len(results))
            return results
