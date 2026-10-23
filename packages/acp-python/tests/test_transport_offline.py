import asyncio
import json
import time
from types import SimpleNamespace

import pytest
from packaging.version import Version

from e2b import CommandExitException
from e2b_acp.transport import READ_QUEUE_MESSAGES, AcpTransport


class FakeAgent:
    """A command handle driven by the test instead of a sandbox."""

    def __init__(self, close_stdin=None):
        self.writes = []
        self.active = 0
        self.max_active = 0
        self.killed = 0
        self.exit = asyncio.get_running_loop().create_future()
        # Like the SDK handle, the exit is seen only after output callbacks return.
        self._output = asyncio.Lock()
        self._close_stdin = close_stdin
        self.handle = SimpleNamespace(
            pid=42,
            send_stdin=self._send_stdin,
            close_stdin=self._close,
            kill=self._kill,
            wait=self._wait,
        )
        self.sandbox = SimpleNamespace(
            commands=SimpleNamespace(_envd_version=Version("0.9.0"), _start=self._start)
        )

    async def _start(self, cmd, on_stdout, **kwargs):
        self.on_stdout = on_stdout
        return self.handle

    async def _send_stdin(self, data):
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0.002)
        self.writes.append(data)
        self.active -= 1

    async def _close(self):
        if self._close_stdin:
            await self._close_stdin()

    async def _kill(self):
        self.killed += 1
        self.exit_with(-1)
        return True

    async def _wait(self):
        try:
            return await asyncio.shield(self.exit)
        finally:
            async with self._output:
                pass

    def exit_with(self, code):
        if self.exit.done():
            return
        if code == 0:
            self.exit.set_result(SimpleNamespace(exit_code=0, error=None))
        else:
            self.exit.set_exception(
                CommandExitException(stdout="", stderr="", exit_code=code, error=None)
            )

    async def emit(self, message):
        async with self._output:
            await self.on_stdout(json.dumps(message) + "\n")


async def start(agent):
    transport = AcpTransport(agent.sandbox, 1024, None)
    await transport.start("agent", None, None, None, None)
    return transport


async def hang():
    await asyncio.Event().wait()


async def test_writes_and_replies_never_overlap():
    agent = FakeAgent()
    transport = await start(agent)

    await asyncio.gather(
        *(
            transport.send({"jsonrpc": "2.0", "id": i, "method": "echo"})
            for i in range(10)
        ),
        *(
            agent.emit(
                {"jsonrpc": "2.0", "id": f"fs-{i}", "method": "fs/read_text_file"}
            )
            for i in range(10)
        ),
    )

    assert len(agent.writes) == 20
    assert agent.max_active == 1


async def test_cancelled_receive_does_not_lose_a_message():
    agent = FakeAgent()
    transport = await start(agent)

    waiting = asyncio.create_task(transport.receive())
    await asyncio.sleep(0)
    await agent.emit({"jsonrpc": "2.0", "method": "update"})
    # Let the waiting receive() wake up, then cancel it.
    await asyncio.sleep(0)
    waiting.cancel()
    await asyncio.gather(waiting, return_exceptions=True)

    if waiting.cancelled():
        # The message stayed queued for the next receive().
        message = await asyncio.wait_for(transport.receive(), 1)
    else:
        message = waiting.result()
    assert message["method"] == "update"


async def test_a_failed_output_stream_kills_the_agent():
    agent = FakeAgent()
    transport = await start(agent)

    agent.exit.set_exception(RuntimeError("output stream broke"))

    with pytest.raises(RuntimeError, match="output stream broke"):
        await asyncio.wait_for(transport.receive(), 1)
    with pytest.raises(RuntimeError, match="output stream broke"):
        await transport.wait()
    assert agent.killed == 1


async def test_close_timeout_covers_a_hung_eof_and_then_kills():
    agent = FakeAgent(close_stdin=hang)
    transport = await start(agent)

    started = time.monotonic()
    await transport.close(timeout=0.05)

    assert time.monotonic() - started < 1
    assert agent.killed == 1


async def test_close_raises_when_the_agent_could_not_be_killed():
    agent = FakeAgent(close_stdin=hang)

    async def fail():
        raise RuntimeError("kill failed")

    agent.handle.kill = fail
    transport = await start(agent)

    with pytest.raises(RuntimeError, match="kill failed"):
        await transport.close(timeout=0.05)


async def test_close_keeps_buffered_messages_and_drops_later_ones():
    agent = FakeAgent()
    transport = await start(agent)

    await agent.emit({"jsonrpc": "2.0", "method": "before"})
    closing = asyncio.create_task(transport.close(timeout=0.05))
    await asyncio.sleep(0)
    await agent.emit({"jsonrpc": "2.0", "method": "after"})
    agent.exit_with(0)
    await closing

    assert (await transport.receive())["method"] == "before"
    assert await transport.receive() is None


async def test_close_releases_a_reader_blocked_on_a_full_queue():
    agent = FakeAgent()
    transport = await start(agent)
    for i in range(READ_QUEUE_MESSAGES):
        await agent.emit({"jsonrpc": "2.0", "method": "update", "params": i})

    # The next message waits for room in the queue.
    blocked = asyncio.create_task(agent.emit({"jsonrpc": "2.0", "method": "late"}))
    await asyncio.sleep(0.01)
    assert not blocked.done()

    closing = asyncio.create_task(transport.close(timeout=0.05))
    await asyncio.wait_for(blocked, 1)
    agent.exit_with(0)
    await closing

    received = []
    while (message := await transport.receive()) is not None:
        received.append(message["method"])
    assert "late" not in received
    assert len(received) == READ_QUEUE_MESSAGES


async def test_kill_lets_wait_see_the_exit_while_output_waits_for_the_client():
    agent = FakeAgent()
    transport = await start(agent)
    for i in range(READ_QUEUE_MESSAGES):
        await agent.emit({"jsonrpc": "2.0", "method": "update", "params": i})

    # The read queue is full, so this callback waits for the client.
    asyncio.create_task(agent.emit({"jsonrpc": "2.0", "method": "late"}))
    await asyncio.sleep(0.01)
    await transport.kill()

    exit = await asyncio.wait_for(transport.wait(), 1)
    assert exit.exit_code == -1
