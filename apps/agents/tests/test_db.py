import pytest

from agents.db import initialize_database
from agents.db.connection import get_connection
from agents.tools import (
    add_customer_address,
    check_inventory,
    create_order,
    get_customer_by_phone,
    get_default_address,
    get_or_create_customer,
    get_order,
    get_product_by_id,
    list_active_products,
    search_products,
    update_order_status,
)


@pytest.mark.asyncio
async def test_database_initialization_idempotent():
    """Verify that initialize_database runs cleanly multiple times without error."""
    await initialize_database()
    await initialize_database()

    async with await get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) as count FROM products")
            row = await cur.fetchone()
            assert row["count"] >= 4


@pytest.mark.asyncio
async def test_search_and_get_products():
    """Verify product search and direct lookup."""
    results = await search_products("salt")
    assert len(results) >= 1
    salt = results[0]
    assert "salt" in salt["name"].lower()

    by_id = await get_product_by_id(salt["id"])
    assert by_id is not None
    assert by_id["name"] == salt["name"]

    all_products = await list_active_products()
    assert len(all_products) >= 4


@pytest.mark.asyncio
async def test_customer_and_address_tools():
    """Verify customer profile creation and delivery address association."""
    test_phone = "+919876543210"
    test_name = "Ramesh Kumar"

    customer = await get_or_create_customer(phone=test_phone, name=test_name)
    assert customer["phone"] == test_phone
    assert customer["name"] == test_name

    cust_lookup = await get_customer_by_phone(test_phone)
    assert cust_lookup is not None
    assert cust_lookup["id"] == customer["id"]

    # Add address
    address = await add_customer_address(
        customer_id=customer["id"],
        address_line1="Flat 402, Gokuldham Society",
        landmark="Near Shiv Temple",
        city="Mumbai",
        state="Maharashtra",
        pincode="400063",
        is_default=True,
    )
    assert address["customer_id"] == customer["id"]
    assert address["is_default"] is True

    default_addr = await get_default_address(customer["id"])
    assert default_addr is not None
    assert default_addr["id"] == address["id"]

    # Cleanup
    async with await get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM customers WHERE id = %s", (customer["id"],))
        await conn.commit()


@pytest.mark.asyncio
async def test_inventory_and_order_flow():
    """Verify inventory checking, reservation, and complete order placement."""
    # Find a product
    products = await search_products("milk")
    assert len(products) >= 1
    product = products[0]

    # Check inventory
    inv = await check_inventory(product_id=product["id"], quantity=2)
    assert inv["available"] is True

    # Setup customer
    cust = await get_or_create_customer(phone="+919111122222", name="Pooja Sharma")
    addr = await add_customer_address(
        customer_id=cust["id"],
        address_line1="12 Sector 4",
        city="Mumbai",
        pincode="400001",
        is_default=True,
    )

    order_id = "TEST-ORD-999"
    order = await create_order(
        order_id=order_id,
        customer_id=cust["id"],
        items=[
            {
                "product_id": product["id"],
                "quantity": 2,
                "unit_price": product["price"],
            }
        ],
        delivery_address_id=addr["id"],
    )
    assert order["id"] == order_id
    assert len(order["items"]) == 1

    # Fetch order
    fetched = await get_order(order_id)
    assert fetched is not None
    assert fetched["status"] == "PENDING"
    assert len(fetched["items"]) == 1
    assert fetched["items"][0]["product_id"] == product["id"]

    # Update status
    updated = await update_order_status(order_id, "CONFIRMED")
    assert updated is not None
    assert updated["status"] == "CONFIRMED"

    # Cleanup
    async with await get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
            await cur.execute("DELETE FROM customers WHERE id = %s", (cust["id"],))
            await cur.execute(
                "UPDATE products SET reserved_quantity = 0 WHERE id = %s",
                (product["id"],),
            )
        await conn.commit()


@pytest.mark.asyncio
async def test_all_tools_strictly_json_serializable():
    """Verify that every tool returns strictly JSON-serializable structures."""
    import json

    # Products
    products = await search_products("salt")
    json_str = json.dumps(products)
    assert json_str is not None

    single = await get_product_by_id(products[0]["id"])
    assert json.dumps(single) is not None

    active = await list_active_products(limit=5)
    assert json.dumps(active) is not None

    # Customers & Addresses
    phone = "+919999900000"
    cust = await get_or_create_customer(phone=phone, name="JSON Test Customer")
    assert json.dumps(cust) is not None

    addr = await add_customer_address(
        customer_id=cust["id"], address_line1="123 Test St", pincode="400001", is_default=True
    )
    assert json.dumps(addr) is not None

    # Inventory
    inv = await check_inventory(products[0]["id"], 1)
    assert json.dumps(inv) is not None

    # Orders
    order_id = "TEST-ORD-JSON-001"
    ord_created = await create_order(
        order_id=order_id,
        customer_id=cust["id"],
        items=[
            {"product_id": products[0]["id"], "quantity": 1, "unit_price": products[0]["price"]}
        ],
        delivery_address_id=addr["id"],
    )
    assert json.dumps(ord_created) is not None

    ord_fetched = await get_order(order_id)
    assert json.dumps(ord_fetched) is not None

    # Cleanup
    async with await get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
            await cur.execute("DELETE FROM customers WHERE id = %s", (cust["id"],))
            await cur.execute(
                "UPDATE products SET reserved_quantity = 0 WHERE id = %s", (products[0]["id"],)
            )
        await conn.commit()
