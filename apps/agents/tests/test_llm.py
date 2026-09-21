import pytest

pytest.importorskip("agents.base")

from unittest.mock import AsyncMock, MagicMock, patch

from agents.base.llm import AnthropicClient, LLMMessage, OpenAIClient, get_llm_client


@pytest.fixture
def openai_client():
    with patch("agents.base.llm.openai.AsyncOpenAI"):
        client = OpenAIClient(api_key="test-key", model="gpt-4")
        yield client


@pytest.fixture
def anthropic_client():
    with patch("agents.base.llm.AsyncAnthropic"):
        client = AnthropicClient(api_key="test-key", model="claude-3")
        yield client


@pytest.mark.asyncio
async def test_openai_complete_stream(openai_client):
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock(delta=MagicMock(content="Hello", tool_calls=None))]

    openai_client.client.chat.completions.create = AsyncMock(return_value=iter([mock_chunk]))

    messages = [LLMMessage(role="user", content="Hi")]
    results = []
    async for chunk in openai_client.complete(messages, stream=True):
        results.append(chunk)

    assert len(results) == 2
    assert results[0].content == "Hello"
    assert results[1].finish_reason == "stop"


@pytest.mark.asyncio
async def test_openai_complete_non_stream(openai_client):
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content="Hello", tool_calls=None), finish_reason="stop")
    ]
    mock_response.usage = MagicMock(model_dump=lambda: {"total_tokens": 10})

    openai_client.client.chat.completions.create = AsyncMock(return_value=mock_response)

    messages = [LLMMessage(role="user", content="Hi")]
    results = []
    async for chunk in openai_client.complete(messages, stream=False):
        results.append(chunk)

    assert len(results) == 1
    assert results[0].content == "Hello"
    assert results[0].finish_reason == "stop"


@pytest.mark.asyncio
async def test_anthropic_complete_stream(anthropic_client):
    mock_chunk = MagicMock()
    mock_chunk.type = "content_block_delta"
    mock_chunk.delta.type = "text"
    mock_chunk.delta.text = "Hello"

    anthropic_client.client.messages.create = AsyncMock(return_value=iter([mock_chunk]))

    messages = [LLMMessage(role="user", content="Hi")]
    results = []
    async for chunk in anthropic_client.complete(messages, stream=True):
        results.append(chunk)

    assert len(results) == 2
    assert results[0].content == "Hello"
    assert results[1].finish_reason == "stop"


def test_get_llm_client_openai():
    with patch("agents.base.llm.settings") as mock_settings:
        mock_settings.DEFAULT_LLM_PROVIDER = "openai"
        mock_settings.OPENAI_API_KEY = "test-key"
        client = get_llm_client()
        assert isinstance(client, OpenAIClient)


def test_get_llm_client_anthropic():
    with patch("agents.base.llm.settings") as mock_settings:
        mock_settings.DEFAULT_LLM_PROVIDER = "anthropic"
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        client = get_llm_client()
        assert isinstance(client, AnthropicClient)
