import pytest

pytest.importorskip("agents.base")


from agents.base import AgentContext, AgentRole, BaseAgent, BaseTool, ToolCall


class MockTool(BaseTool):
    name = "mock_tool"
    description = "A mock tool for testing"
    parameters = {"type": "object", "properties": {"value": {"type": "string"}}}

    async def execute(self, value: str) -> str:
        return f"processed: {value}"


class MockAgent(BaseAgent):
    async def process(self, input: str, context: AgentContext):
        yield "test response"


@pytest.fixture
def mock_tool():
    return MockTool()


@pytest.fixture
def mock_agent(mock_tool):
    return MockAgent(name="Test Agent", role=AgentRole.ASSISTANT, tools=[mock_tool])


def test_agent_initialization(mock_agent):
    assert mock_agent.name == "Test Agent"
    assert mock_agent.role == AgentRole.ASSISTANT
    assert len(mock_agent.tools) == 1
    assert mock_agent.status.value == "idle"


def test_agent_add_tool(mock_agent):
    new_tool = MockTool()
    new_tool.name = "another_tool"
    mock_agent.add_tool(new_tool)
    assert len(mock_agent.tools) == 2
    assert mock_agent.get_tool("another_tool") is not None


@pytest.mark.asyncio
async def test_agent_run(mock_agent):
    context = AgentContext()
    results = []
    async for chunk in mock_agent.run("test input", context):
        results.append(chunk)
    assert results == ["test response"]
    assert mock_agent.status.value == "completed"


@pytest.mark.asyncio
async def test_execute_tool(mock_agent):
    tool_call = ToolCall(name="mock_tool", arguments={"value": "test"})
    result = await mock_agent.execute_tool(tool_call)
    assert result.result == "processed: test"
    assert result.error is None


@pytest.mark.asyncio
async def test_execute_unknown_tool(mock_agent):
    tool_call = ToolCall(name="unknown_tool", arguments={})
    result = await mock_agent.execute_tool(tool_call)
    assert result.error is not None
    assert "not found" in result.error


def test_get_openai_tools(mock_agent):
    tools = mock_agent.get_openai_tools()
    assert len(tools) == 1
    assert tools[0]["function"]["name"] == "mock_tool"
