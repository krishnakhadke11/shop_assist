import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agents.tools import (
    SearchProductsTool,
    GetProductTool,
    CreateProductTool,
    UpdateProductTool,
    DeleteProductTool,
    ALL_TOOLS,
    get_tools_by_names,
)


@pytest.fixture
def mock_api_client():
    with patch("agents.tools.api_client") as mock:
        yield mock


@pytest.mark.asyncio
async def test_search_products_tool(mock_api_client):
    mock_response = MagicMock()
    mock_response.success = True
    mock_response.data = [
        {"id": "1", "name": "Apple iPhone", "price": 999.0, "description": "Latest iPhone"},
        {"id": "2", "name": "Samsung Galaxy", "price": 899.0, "description": "Android phone"},
    ]
    mock_api_client.list_products = AsyncMock(return_value=mock_response)

    tool = SearchProductsTool()
    result = await tool.execute(query="phone", limit=5)

    assert len(result) == 2
    assert all("phone" in p["name"].lower() or "phone" in p.get("description", "").lower() for p in result)


@pytest.mark.asyncio
async def test_get_product_tool(mock_api_client):
    mock_response = MagicMock()
    mock_response.success = True
    mock_response.data = {"id": "1", "name": "Test Product", "price": 100.0}
    mock_api_client.get_product = AsyncMock(return_value=mock_response)

    tool = GetProductTool()
    result = await tool.execute(product_id="1")

    assert result["name"] == "Test Product"
    assert result["price"] == 100.0


@pytest.mark.asyncio
async def test_create_product_tool(mock_api_client):
    mock_response = MagicMock()
    mock_response.success = True
    mock_response.data = {"id": "new-id", "name": "New Product", "price": 50.0}
    mock_api_client.create_product = AsyncMock(return_value=mock_response)

    tool = CreateProductTool()
    result = await tool.execute(name="New Product", price=50.0, description="Test")

    assert result["name"] == "New Product"
    assert result["price"] == 50.0


@pytest.mark.asyncio
async def test_update_product_tool(mock_api_client):
    mock_response = MagicMock()
    mock_response.success = True
    mock_response.data = {"id": "1", "name": "Updated Product", "price": 75.0}
    mock_api_client.update_product = AsyncMock(return_value=mock_response)

    tool = UpdateProductTool()
    result = await tool.execute(product_id="1", name="Updated Product", price=75.0)

    assert result["name"] == "Updated Product"


@pytest.mark.asyncio
async def test_delete_product_tool(mock_api_client):
    mock_response = MagicMock()
    mock_response.success = True
    mock_api_client.delete_product = AsyncMock(return_value=mock_response)

    tool = DeleteProductTool()
    result = await tool.execute(product_id="1")

    assert result is True


def test_all_tools():
    assert len(ALL_TOOLS) == 5
    tool_names = {tool.name for tool in ALL_TOOLS}
    assert tool_names == {
        "search_products",
        "get_product",
        "create_product",
        "update_product",
        "delete_product",
    }


def test_get_tools_by_names():
    tools = get_tools_by_names(["search_products", "create_product"])
    assert len(tools) == 2
    assert {t.name for t in tools} == {"search_products", "create_product"}


def test_get_tools_by_names_invalid():
    tools = get_tools_by_names(["invalid_tool"])
    assert len(tools) == 0