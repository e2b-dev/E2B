import asyncio

import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError

from e2b import (
    AsyncSandbox,
    NotFoundException,
    SandboxException,
    SandboxNotRunningException,
    TimeoutException,
)
from e2b.sandbox_async.commands.command_input_handle import AsyncCommandInputHandle


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


@pytest.mark.parametrize("kind", ["stdin", "pty"])
async def test_async_command_input_handle_rejects_input_during_health_check(kind):
    class FakeRpc:
        async def stream_input(self, requests, timeout_ms=None):
            raise ConnectError(Code.UNAVAILABLE, "stream reset")

    health_started = asyncio.Event()
    health_finished = asyncio.Event()

    async def check_health():
        health_started.set()
        await health_finished.wait()
        return False

    stream = AsyncCommandInputHandle(FakeRpc(), 42, kind, 0, check_health)
    await asyncio.wait_for(health_started.wait(), timeout=1)
    send = asyncio.create_task(stream.send("late"))
    await asyncio.sleep(0)
    health_finished.set()

    send_result, close_result = await asyncio.gather(
        send, stream.close(), return_exceptions=True
    )
    assert isinstance(send_result, SandboxNotRunningException)
    assert isinstance(close_result, SandboxNotRunningException)


async def test_async_command_input_handle_orders_data_and_sends_keepalives():
    class FakeRpc:
        async def stream_input(self, requests, timeout_ms=None):
            assert timeout_ms is None
            self.requests = [request async for request in requests]

    rpc = FakeRpc()
    stream = AsyncCommandInputHandle(
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
    with pytest.raises(SandboxException, match="sandbox.commands.stream_input"):
        await stream.send("late")


async def test_async_command_input_handle_close_survives_cancelled_wait():
    class FakeRpc:
        def __init__(self):
            self.gate = asyncio.Event()

        async def stream_input(self, requests, timeout_ms=None):
            await self.gate.wait()
            self.requests = [request async for request in requests]

    rpc = FakeRpc()
    handle = AsyncCommandInputHandle(rpc, 42, "stdin", 0, lambda: None)
    await handle.send(b"payload")

    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(handle.close(), 0.01)

    rpc.gate.set()
    await handle.close()

    data = [
        request.event.value.input.input.value
        for request in rpc.requests
        if request.event.field == "data"
    ]
    assert data == [b"payload"]
