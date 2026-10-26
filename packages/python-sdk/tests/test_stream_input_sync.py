from typing import cast

import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError

from e2b.envd.process import process_connect
from e2b.exceptions import InvalidArgumentException, NotFoundException
from e2b.sandbox.commands.stream_input import stream_input_sync


class _FakeRpc:
    def __init__(self, error=None):
        self.requests = []
        self.timeout_ms = None
        self._error = error

    def stream_input(self, requests, timeout_ms=None):
        self.timeout_ms = timeout_ms
        self.requests = list(requests)
        if self._error is not None:
            raise self._error


def _client(rpc: _FakeRpc) -> process_connect.ProcessClientSync:
    return cast(process_connect.ProcessClientSync, rpc)


@pytest.mark.parametrize("input_kind", ["stdin", "pty"])
def test_sends_start_then_data_events(input_kind):
    rpc = _FakeRpc()

    stream_input_sync(_client(rpc), 42, input_kind, ["a", b"b"], 5, lambda: True)

    start, *data = rpc.requests
    assert start.event.field == "start"
    assert start.event.value.process.selector.value == 42
    assert [(r.event.field, r.event.value.input.input.field) for r in data] == [
        ("data", input_kind),
        ("data", input_kind),
    ]
    assert [r.event.value.input.input.value for r in data] == [b"a", b"b"]
    assert rpc.timeout_ms == 5000


@pytest.mark.parametrize("chunk", ["data", b"data", bytearray(b"data")])
def test_rejects_single_chunk(chunk):
    rpc = _FakeRpc()

    with pytest.raises(InvalidArgumentException):
        stream_input_sync(_client(rpc), 1, "stdin", chunk, None, lambda: True)

    assert rpc.requests == []


def test_maps_rpc_errors():
    rpc = _FakeRpc(error=ConnectError(Code.NOT_FOUND, "missing"))

    with pytest.raises(NotFoundException):
        stream_input_sync(_client(rpc), 1, "pty", ["x"], None, lambda: True)
