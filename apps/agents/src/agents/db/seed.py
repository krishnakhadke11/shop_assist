import logging

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)

PRODUCTS = [
    (
        "Tata Salt",
        "Tata",
        "Salt",
        "packet",
        1,
        28.00,
        100,
        ["tata salt", "tata solt", "salt", "namak"],
    ),
    (
        "Amul Taaza Milk",
        "Amul",
        "Milk",
        "litre",
        1,
        58.00,
        50,
        ["amul milk", "amul doodh", "milk", "doodh", "taaza milk"],
    ),
    (
        "Parle-G Biscuits",
        "Parle",
        "Biscuits",
        "packet",
        1,
        10.00,
        200,
        ["parle g", "parle-g", "parle biscuit", "biscuit"],
    ),
    (
        "Aashirvaad Atta",
        "Aashirvaad",
        "Flour",
        "kg",
        5,
        320.00,
        40,
        ["aashirvaad atta", "atta", "flour"],
    ),
]


async def seed_products() -> None:
    """Seed initial catalog products idempotently."""
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            for product in PRODUCTS:
                await cursor.execute(
                    """
                    INSERT INTO products (
                        name,
                        brand,
                        category,
                        unit,
                        pack_size,
                        price,
                        inventory_quantity,
                        aliases
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (name) DO NOTHING
                    """,
                    product,
                )

        await connection.commit()
    logger.info("Products seeded successfully.")
