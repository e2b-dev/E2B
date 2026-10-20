import time
from typing import Any, cast

import pytest

from e2b import InvalidArgumentException, NotFoundException, Sandbox, TimeoutException
from e2b.sandbox_sync.commands.command import Commands


def test_stream_input_to_command(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)

    def input_lines():
        yield "first\n"
        time.sleep(1)
        yield "second\n"
        time.sleep(1)
        yield b"third\n"

    sandbox.commands.stream_input(cmd.pid, input_lines(), timeout=0)

    sandbox.commands.close_stdin(cmd.pid)
    result = cmd.wait()
    assert result.stdout.splitlines() == ["first", "second", "third"]


def test_stream_input_reports_missing_command(sandbox: Sandbox):
    with pytest.raises(NotFoundException):
        sandbox.commands.stream_input(999999, ["data"])


def test_stream_input_rejects_single_chunk(sandbox: Sandbox):
    with pytest.raises(InvalidArgumentException, match=r"\[data\]"):
        sandbox.commands.stream_input(1, cast(Any, b"ls\n"))


def test_stream_input_timeout(sandbox: Sandbox):
    cmd = sandbox.commands.run("cat", background=True, stdin=True)

    def slow_input():
        yield "first\n"
        time.sleep(2)
        yield "second\n"

    with pytest.raises(TimeoutException):
        sandbox.commands.stream_input(cmd.pid, slow_input(), timeout=1)

    sandbox.commands.close_stdin(cmd.pid)
    cmd.wait()


def test_stream_input_orders_start_and_data():
    class FakeRpc:
        def stream_input(self, requests, timeout_ms=None):
            assert timeout_ms is None
            self.requests = list(requests)

    rpc = FakeRpc()
    commands = Commands.__new__(Commands)
    commands._rpc = rpc
    commands._check_health = lambda: None
    commands.stream_input(42, ["first", "café", b"second"], timeout=0)
    events = [request.event for request in rpc.requests]
    assert events[0].field == "start"
    data = [event.value.input.input.value for event in events if event.field == "data"]
    assert data == [b"first", b"caf\xc3\xa9", b"second"]
