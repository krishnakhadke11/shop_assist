import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_orders_lifecycle(client: AsyncClient):
    # 1. Place a new order
    order_payload = {
        "customer_phone": "9870999999",
        "customer_name": "Test Customer",
        "merchant_id": "m1",
        "merchant_name": "Sharma Kirana Store",
        "merchant_phone": "9876543210",
        "items": [
            {
                "name": "Tata Salt",
                "quantity": 2,
                "unit": "packet",
                "unit_price": 28.00,
            },
            {
                "name": "Parle-G",
                "quantity": 3,
                "unit": "packet",
                "unit_price": 10.00,
            },
        ],
        "status": "pending",
    }

    create_res = await client.post("/api/v1/orders", json=order_payload)
    assert create_res.status_code == 201
    created_order = create_res.json()
    order_id = created_order["order_id"]
    assert order_id.startswith("ORD-")
    assert created_order["state"] == "pending"
    assert created_order["customer_phone"] == "9870999999"
    assert len(created_order["items"]) == 2

    # Rule B-01: No price before confirmed
    assert created_order["price"] is None

    # 2. Get active orders
    active_res = await client.get("/api/v1/orders/active?phone=9870999999")
    assert active_res.status_code == 200
    active_orders = active_res.json()
    assert any(o["order_id"] == order_id for o in active_orders)

    # 3. Get order by ID
    get_res = await client.get(f"/api/v1/orders/{order_id}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["order_id"] == order_id
    assert detail["merchant"]["name"] == "Sharma Kirana Store"

    # 4. Transition status to confirmed
    patch_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={
            "status": "confirmed",
            "price": 86.00,
            "eta": "20 mins",
        },
    )
    assert patch_res.status_code == 200
    confirmed_order = patch_res.json()
    assert confirmed_order["state"] == "confirmed"
    assert confirmed_order["price"] == 86.00
    assert confirmed_order["eta"] == "20 mins"

    # 5. Verify it is no longer in active orders
    active_after = await client.get("/api/v1/orders/active?phone=9870999999")
    assert not any(o["order_id"] == order_id for o in active_after.json())

    # 6. Verify it is in list orders
    list_res = await client.get("/api/v1/orders?phone=9870999999")
    assert list_res.status_code == 200
    assert any(o["order_id"] == order_id for o in list_res.json())


@pytest.mark.asyncio
async def test_order_modified_diff(client: AsyncClient):
    order_payload = {
        "customer_phone": "9870888888",
        "customer_name": "Diff Customer",
        "merchant_id": "m1",
        "merchant_name": "Sharma Kirana Store",
        "items": [
            {
                "name": "Atta",
                "quantity": 2,
                "unit": "kg",
                "unit_price": 50.00,
            }
        ],
        "status": "pending",
    }

    create_res = await client.post("/api/v1/orders", json=order_payload)
    assert create_res.status_code == 201
    order_id = create_res.json()["order_id"]

    # Merchant AI modifies the quantity
    patch_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={
            "status": "modified",
            "price": 50.00,
            "eta": "15 mins",
            "changes": [
                {
                    "field": "quantity",
                    "item": "Atta",
                    "from": "2 kg",
                    "to": "1 kg",
                }
            ],
        },
    )
    assert patch_res.status_code == 200
    mod_order = patch_res.json()
    assert mod_order["state"] == "modified"
    assert len(mod_order["changes"]) == 1
    assert mod_order["changes"][0]["from"] == "2 kg"
    assert mod_order["changes"][0]["to"] == "1 kg"


@pytest.mark.asyncio
async def test_get_nonexistent_order(client: AsyncClient):
    res = await client.get("/api/v1/orders/ORD-NONEXISTENT")
    assert res.status_code == 404
