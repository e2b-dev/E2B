"""
`request_timeout` on async streaming calls bounds opening the stream — the
wait for the start event — mirroring the JS SDK's ``requestTimeoutMs`` timer
that is disarmed once the stream is open. The stream itself stays bounded by
`timeout` only.

The tricky part is cancellation: ``asyncio.wait_for`` delivers its expiry as
a cancellation, which connectrpc converts into ``ConnectError(CANCELED)``
before ``wait_for`` can turn it into ``TimeoutError``. The helper must
surface that as ``TimeoutException`` while a caller genuinely cancelling the
task keeps its cancellation semantics. ``test_envd_stream_reset`` pins the
frame-level counterpart: a timed-out setup cancels the HTTP/2 stream
(``RST_STREAM``) instead of leaving it attached to envd.
"""

import asyncio
import time

import httpx
import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from envd_frame_server import make_config
from packaging.version import Version

import e2b.sandbox_async.commands.command as command_async
from e2b.envd.client_async import first_event
from e2b.envd.rpc import handle_rpc_exception
from e2b.exceptions import TimeoutException
from e2b.sandbox_async.commands.command import Commands


async def connectrpc_style_stream(delay: float):
    # connectrpc's stream generator converts the CancelledError delivered by
    # wait_for's expiry into ConnectError(CANCELED) (see _client_async).
    try:
        await asyncio.sleep(delay)
        yield "start"
    except asyncio.CancelledError as e:
        raise ConnectError(Code.CANCELED, "Request was cancelled") from e


async def test_returns_first_event():
    assert await first_event(connectrpc_style_stream(0), 5) == "start"


async def test_no_request_timeout_means_unbounded():
    assert await first_event(connectrpc_style_stream(0.05), None) == "start"


async def test_timeout_raises_timeout_exception():
    start = time.monotonic()
    with pytest.raises(TimeoutException, match="request_timeout"):
        await first_event(connectrpc_style_stream(30), 0.1)
    assert time.monotonic() - start < 5


async def test_timeout_when_cancellation_propagates():
    # A stream cancelled outside connectrpc's conversion scope (e.g. before
    # the request is sent) lets wait_for raise TimeoutError itself.
    async def plain_stream():
        await asyncio.sleep(30)
        yield "start"

    with pytest.raises(TimeoutException, match="request_timeout"):
        await first_event(plain_stream(), 0.1)


async def test_external_cancellation_is_not_masked():
    seen: list[BaseException] = []

    async def call():
        try:
            await first_event(connectrpc_style_stream(30), 30)
        except BaseException as e:
            seen.append(e)
            raise

    task = asyncio.ensure_future(call())
    await asyncio.sleep(0.05)
    task.cancel()
    with pytest.raises(BaseException):
        await task

    assert len(seen) == 1
    # Depending on the Python version the cancellation surfaces directly or
    # as connectrpc's converted error — either way the call sites'
    # handle_rpc_exception must restore the CancelledError, never a timeout.
    err = seen[0]
    if isinstance(err, ConnectError):
        err = handle_rpc_exception(err)
    assert isinstance(err, asyncio.CancelledError)


async def test_commands_connect_applies_request_timeout(monkeypatch):
    class NeverStartingRpc:
        def connect(self, req, headers=None, timeout_ms=None):
            return connectrpc_style_stream(30)

    # Hand Commands the stub directly; the real factory would register a
    # pooled transport in the process-global cache.
    monkeypatch.setattr(
        command_async, "create_rpc_client", lambda *_args, **_kwargs: NeverStartingRpc()
    )
    commands = Commands(
        "http://127.0.0.1:1",
        make_config(),
        Version("0.5.0"),
        httpx.AsyncClient(),
    )

    start = time.monotonic()
    with pytest.raises(TimeoutException, match="request_timeout"):
        await commands.connect(pid=1, request_timeout=0.1)
    assert time.monotonic() - start < 5
