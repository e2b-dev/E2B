import asyncio

import pytest

from e2b import AsyncSandbox, NotFoundException, SandboxException, TimeoutException
from e2b.sandbox_async.commands.command_input_stream import AsyncCommandInputStream


async def test_stream_input_to_command(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("cat", background=True, stdin=True)
    stream = async_sandbox.commands.stream_input(cmd.pid, timeout=0)
    await stream.send("a")
    await stream.send("b\n")
    await stream.send(b"c")
    await stream.close()

    await async_sandbox.commands.close_stdin(cmd.pid)
    result = await cmd.wait()
    assert result.stdout == "ab\nc"


async def test_stream_input_reports_missing_command(async_sandbox: AsyncSandbox):
    stream = async_sandbox.commands.stream_input(999999)
    try:
        await stream.send("data")
    except NotFoundException:
        pass

    with pytest.raises(NotFoundException):
        await stream.close()


async def test_stream_input_timeout(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("cat", background=True, stdin=True)
    stream = async_sandbox.commands.stream_input(cmd.pid, timeout=1)
    await asyncio.sleep(2)

    with pytest.raises(TimeoutException):
        await stream.close()


async def test_async_command_input_stream_orders_data_and_sends_keepalives():
    class FakeRpc:
        async def stream_input(self, requests, timeout_ms=None):
            assert timeout_ms is None
            self.requests = [request async for request in requests]

    rpc = FakeRpc()
    stream = AsyncCommandInputStream(
        rpc, 42, "stdin", 0, lambda: None, _keepalive_interval=0.01
    )
    await stream.send("first")
    await asyncio.sleep(0.04)
    await stream.send(b"second")
    await stream.close()

    events = [request.event for request in rpc.requests]
    assert events[0].field == "start"
    assert [event.field for event in events].count("keepalive") >= 1
    data = [event.value.input.input.value for event in events if event.field == "data"]
    assert data == [b"first", b"second"]
    await stream.close()
    with pytest.raises(SandboxException, match="after the stream is closed"):
        await stream.send("late")
