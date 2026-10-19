import time

import pytest

from e2b import NotFoundException, Sandbox, SandboxException, TimeoutException
from e2b.sandbox_sync.commands.command_input_stream import CommandInputStream


def test_stream_input_to_command(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    stream = sandbox.commands.stream_input(cmd.pid, timeout=0)
    stream.send("a")
    stream.send("b\n")
    stream.send(b"c")
    stream.close()

    sandbox.commands.close_stdin(cmd.pid)
    result = cmd.wait()
    assert result.stdout == "ab\nc"


def test_stream_input_reports_missing_command(sandbox: Sandbox):
    stream = sandbox.commands.stream_input(999999)
    try:
        stream.send("data")
    except NotFoundException:
        pass

    with pytest.raises(NotFoundException):
        stream.close()


def test_stream_input_timeout(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)
    stream = sandbox.commands.stream_input(cmd.pid, timeout=1)
    time.sleep(2)

    with pytest.raises(TimeoutException):
        stream.close()


def test_command_input_stream_orders_data_and_sends_keepalives():
    class FakeRpc:
        def stream_input(self, requests, timeout_ms=None):
            assert timeout_ms is None
            self.requests = list(requests)

    rpc = FakeRpc()
    stream = CommandInputStream(
        rpc, 42, "stdin", 0, lambda: None, _keepalive_interval=0.01
    )
    stream.send("first")
    time.sleep(0.04)
    stream.send(b"second")
    stream.close()

    events = [request.event for request in rpc.requests]
    assert events[0].field == "start"
    assert [event.field for event in events].count("keepalive") >= 1
    data = [event.value.input.input.value for event in events if event.field == "data"]
    assert data == [b"first", b"second"]
    stream.close()
    with pytest.raises(SandboxException, match="after the stream is closed"):
        stream.send("late")
