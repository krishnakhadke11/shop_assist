import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agents.base.api_client import BackendAPIClient, APIResponse


@pytest.fixture
def api_client():
    with patch("agents.base.api_client.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client
        client = BackendAPIClient(base_url="http://test", api_key="test-key")
        client.client = mock_client
        yield client


@pytest.mark.asyncio
async def test_health_check_success(api_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "healthy"}
    mock_response.raise_for_status = MagicMock()
    
    api_client.client.request = AsyncMock(return_value=mock_response)
    
    result = await api_client.health_check()
    
    assert result.success is True
    assert result.data == {"status": "healthy"}
    assert result.status_code == 200


@pytest.mark.asyncio
async def test_health_check_error(api_client):
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_response.raise_for_status = MagicMock(side_effect=Exception("500"))
    
    api_client.client.request = AsyncMock(return_value=mock_response)
    
    result = await api_client.health_check()
    
    assert result.success is False
    assert result.error is not None
    assert result.status_code == 500


@pytest.mark.asyncio
async def test_list_products(api_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [{"id": "1", "name": "Product 1", "price": 10.0}]
    mock_response.raise_for_status = MagicMock()
    
    api_client.client.request = AsyncMock(return_value=mock_response)
    
    result = await api_client.list_products(skip=0, limit=10)
    
    assert result.success is True
    assert len(result.data) == 1


@pytest.mark.asyncio
async def test_create_product(api_client):
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"id": "1", "name": "New Product", "price": 20.0}
    mock_response.raise_for_status = MagicMock()
    
    api_client.client.request = AsyncMock(return_value=mock_response)
    
    result = await api_client.create_product("New Product", 20.0, "Description")
    
    assert result.success is True
    assert result.data["name"] == "New Product"


@pytest.mark.asyncio
async def test_get_product_not_found(api_client):
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_response.text = "Not Found"
    mock_response.raise_for_status = MagicMock(side_effect=Exception("404"))
    
    api_client.client.request = AsyncMock(return_value=mock_response)
    
    result = await api_client.get_product("invalid-id")
    
    assert result.success is False
    assert result.status_code == 404