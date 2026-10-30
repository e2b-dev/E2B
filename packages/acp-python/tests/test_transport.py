import pytest

from e2b import AsyncSandbox
from e2b_acp.transport import ACPTransport
from e2b_acp.utils import DEFAULT_MAX_MESSAGE_BYTES
from acp_fake_agent import FAKE_AGENT, FAKE_AGENT_CMD, FAKE_AGENT_PATH


async def start_agent(
    sandbox: AsyncSandbox,
    max_message_bytes=DEFAULT_MAX_MESSAGE_BYTES,
    on_stderr=None,
):
    await sandbox.files.write(FAKE_AGENT_PATH, FAKE_AGENT)
    agent = ACPTransport(sandbox, max_message_bytes, on_stderr)
    await agent.start(FAKE_AGENT_CMD, None, None, None, None)

    async def call(id, method, params=None):
        await agent.send(
            {"jsonrpc": "2.0", "id": id, "method": method, "params": params or {}}
        )
        return await agent.receive()

    return agent, call


async def test_initialize_reaches_agent_without_client_fs_and_terminal(
    async_sandbox: AsyncSandbox,
):
    agent, call = await start_agent(async_sandbox)

    response = await call(
        0,
        "initialize",
        {
            "protocolVersion": 1,
            "clientCapabilities": {
                "fs": {"readTextFile": True, "writeTextFile": True},
                "terminal": True,
            },
        },
    )

    assert response["result"]["received"]["clientCapabilities"] == {
        "fs": {"readTextFile": False, "writeTextFile": False},
        "terminal": False,
    }
    await agent.close()


async def test_agent_requests_for_client_fs_and_terminal_are_rejected(
    async_sandbox: AsyncSandbox,
):
    agent, call = await start_agent(async_sandbox)

    for id, method in [
        (1, "fs/write_text_file"),
        (2, "fs/read_text_file"),
        (3, "terminal/create"),
    ]:
        # The client only sees the agent's final answer, never the request.
        response = await call(id, "test/client_call", {"method": method})
        assert response["id"] == id
        assert response["result"]["error"]["code"] == -32601

    # Notifications are dropped; the next message is the response.
    assert (await call(4, "test/notify_client"))["result"] == "sent"
    await agent.close()


async def test_messages_split_into_single_bytes_are_reassembled(
    async_sandbox: AsyncSandbox,
):
    agent, call = await start_agent(async_sandbox)
    text = "Привет 🌍 E2B"

    assert (await call(5, "test/bytewise", {"text": text}))["result"] == text
    await agent.close()


async def test_invalid_agent_output_gets_parse_error_and_stream_continues(
    async_sandbox: AsyncSandbox,
):
    agent, call = await start_agent(async_sandbox)

    assert (await call(6, "test/garbage"))["result"] == "garbage sent"

    # The agent got a parse error reply, and the stream still works.
    assert (await call(7, "test/errors"))["result"][0]["code"] == -32700
    await agent.close()


async def test_messages_over_the_limit_fail_the_stream(async_sandbox: AsyncSandbox):
    agent, call = await start_agent(async_sandbox, max_message_bytes=1024)

    with pytest.raises(Exception, match="exceeds the limit of 1024 bytes"):
        await call(7, "test/big", {"size": 4096})
    await agent.close()


async def test_close_sends_eof_and_ends_the_stream(async_sandbox: AsyncSandbox):
    agent, _ = await start_agent(async_sandbox)

    await agent.close()

    assert await agent.receive() is None
    exit = await agent.wait()
    assert exit.exit_code == 0


async def test_agent_failure_errors_the_stream_with_its_stderr(
    async_sandbox: AsyncSandbox,
):
    stderr = []
    agent, call = await start_agent(async_sandbox, on_stderr=stderr.append)

    with pytest.raises(Exception, match=r"exited with code 3[\s\S]*boom"):
        await call(9, "test/exit", {"code": 3, "stderr": "boom"})
    assert "".join(stderr) == "boom"
    assert (await agent.wait()).exit_code == 3
