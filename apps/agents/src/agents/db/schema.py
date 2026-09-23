import logging

from agents.db.connection import get_connection

logger = logging.getLogger(__name__)

CREATE_EXTENSIONS = """
CREATE EXTENSION IF NOT EXISTS pg_trgm;
"""

CREATE_PRODUCTS = """
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    category VARCHAR(100),

    unit VARCHAR(50) NOT NULL,
    pack_size NUMERIC(12, 3),

    price NUMERIC(12, 2) NOT NULL
        CHECK (price >= 0),

    inventory_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (inventory_quantity >= 0),

    reserved_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (reserved_quantity >= 0),

    aliases TEXT[] DEFAULT '{}',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_CUSTOMERS = """
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_ADDRESSES = """
CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES customers(id)
        ON DELETE CASCADE,

    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    landmark TEXT,

    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_ORDERS = """
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES customers(id),

    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    delivery_address_id BIGINT
        REFERENCES addresses(id),

    total_amount NUMERIC(12, 2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

CREATE_ORDER_ITEMS = """
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id VARCHAR(50) NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id BIGINT
        REFERENCES products(id),

    item_name VARCHAR(255),
    unit VARCHAR(50) DEFAULT 'item',

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_price NUMERIC(12, 2) NOT NULL
        CHECK (unit_price >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(order_id, product_id)
);
"""

CREATE_INVENTORY_RESERVATIONS = """
CREATE TABLE IF NOT EXISTS inventory_reservations (
    id BIGSERIAL PRIMARY KEY,

    order_id VARCHAR(50) NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    status VARCHAR(30) NOT NULL DEFAULT 'RESERVED',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    released_at TIMESTAMPTZ,

    UNIQUE(order_id, product_id)
);
"""

INDEX_STATEMENTS = [
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name ON products (name);",
    "CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);",
    "CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING gin (brand gin_trgm_ops);",
    "CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);",
    "CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order ON inventory_reservations(order_id);",
    "CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);",
]


async def initialize_schema() -> None:
    """Initialize PostgreSQL database schema and indexes."""
    async with await get_connection() as connection:
        async with connection.cursor() as cursor:
            try:
                await cursor.execute(CREATE_EXTENSIONS)
            except Exception as e:
                logger.warning("Could not execute '%s': %s", CREATE_EXTENSIONS.strip(), e)

            await cursor.execute(CREATE_PRODUCTS)
            await cursor.execute(CREATE_CUSTOMERS)
            await cursor.execute(CREATE_ADDRESSES)
            await cursor.execute(CREATE_ORDERS)
            await cursor.execute(CREATE_ORDER_ITEMS)
            await cursor.execute(CREATE_INVENTORY_RESERVATIONS)

            # Deduplicate any duplicate products before creating unique index
            await cursor.execute(
                "DELETE FROM products a USING products b WHERE a.id > b.id AND a.name = b.name;"
            )

            for index_stmt in INDEX_STATEMENTS:
                try:
                    await cursor.execute(index_stmt)
                except Exception as e:
                    logger.warning("Could not execute index '%s': %s", index_stmt.strip(), e)

        await connection.commit()
