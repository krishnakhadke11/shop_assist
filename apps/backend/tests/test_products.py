import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from decimal import Decimal


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_create_product(client):
    product_data = {
        "name": "Test Product",
        "price": "29.99",
        "description": "A test product"
    }
    response = await client.post("/api/v1/products", json=product_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Product"
    assert data["price"] == "29.99"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_products(client):
    response = await client.get("/api/v1/products")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_product_not_found(client):
    response = await client.get("/api/v1/products/9999999")
    assert response.status_code == 404