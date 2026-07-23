"""Interceptor behavior the SDK relies on but connectrpc doesn't guarantee:

- Closing a server stream early must reach the innermost (transport)
  generator synchronously — hyper only sends RST_STREAM when its generator is
  closed, and a stranded inner generator defers that to GC.
- Streaming RPCs retry only connection-establishment failures, and only
  before the first message, so a delivered request is never replayed.
"""

import logging
from functools import partial

import pytest
from connectrpc._interceptor_async import (
    MetadataInterceptor,
    resolve_interceptors as resolve_interceptors_async,
)
from connectrpc._interceptor_sync import (
    MetadataInterceptorSync,
    resolve_interceptors as resolve_interceptors_sync,
)
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from pyqwest import WriteError
from unittest.mock import MagicMock

from e2b.connection_config import ConnectionConfig
from e2b.envd.interceptors import (
    DefaultHeadersInterceptor,
    RetryInterceptor,
    build_interceptors,
)


def _ctx():
    ctx = MagicMock()
    ctx.request_headers = {}
    ctx.method.service_name = "svc"
    ctx.method.name = "method"
    return ctx


def _connect_error(code: Code, cause: BaseException) -> ConnectError:
    try:
        raise ConnectError(code, str(cause)) from cause
    except ConnectError as e:
        return e


def _compose_sync(interceptors, base):
    execute = base
    for interceptor in reversed(resolve_interceptors_sync(interceptors)):
        method = getattr(interceptor, "intercept_server_stream_sync", None)
        if method is not None:
            execute = partial(method, execute)
    return execute


def _compose_async(interceptors, base):
    execute = base
    for interceptor in reversed(resolve_interceptors_async(interceptors)):
        method = getattr(interceptor, "intercept_server_stream", None)
        if method is not None:
            execute = partial(method, execute)
    return execute


def test_headers_interceptor_is_not_a_metadata_interceptor():
    # connectrpc wraps metadata interceptors around server streams in a
    # generator that doesn't propagate close()/aclose() to the inner stream —
    # the headers interceptor must resolve as a direct interceptor instead.
    interceptor = DefaultHeadersInterceptor({})
    assert not isinstance(interceptor, MetadataInterceptor)
    assert not isinstance(interceptor, MetadataInterceptorSync)


def test_headers_interceptor_applies_defaults_and_keeps_per_call_headers():
    interceptor = DefaultHeadersInterceptor({"User-Agent": "sdk", "X-Token": "t"})
    ctx = _ctx()
    ctx.request_headers = {"X-Token": "per-call"}
    result = interceptor.intercept_server_stream_sync(
        lambda request, ctx: iter(["ok"]), None, ctx
    )
    assert ctx.request_headers == {"X-Token": "per-call", "User-Agent": "sdk"}
    assert list(result) == ["ok"]


def _full_chain_config() -> ConnectionConfig:
    # The logger is the worst case: it adds a generator interceptor layer
    # around every server stream.
    return ConnectionConfig(api_key="k", logger=logging.getLogger("test"))


def test_sync_stream_close_reaches_transport_generator():
    closed = []

    def transport(request, ctx):
        try:
            for i in range(10):
                yield i
        finally:
            closed.append(True)

    stream = _compose_sync(
        build_interceptors(_full_chain_config(), "http://base"), transport
    )(None, _ctx())
    assert next(stream) == 0
    stream.close()
    assert closed == [True]


async def test_async_stream_close_reaches_transport_generator():
    # Before the interceptors propagated aclose(), the transport generator
    # was only finalized by the event loop's async-generator GC hook, several
    # loop iterations after aclose() returned.
    closed = []

    async def transport(request, ctx):
        try:
            for i in range(10):
                yield i
        finally:
            closed.append(True)

    stream = _compose_async(
        build_interceptors(_full_chain_config(), "http://base"), transport
    )(None, _ctx())
    assert await stream.__anext__() == 0
    await stream.aclose()
    assert closed == [True]


def test_stream_retries_connect_failures_sync():
    attempts = []

    def transport(request, ctx):
        attempts.append(True)
        if len(attempts) < 3:
            raise _connect_error(Code.UNAVAILABLE, ConnectionError("tcp connect error"))
        yield "first"
        yield "second"

    stream = RetryInterceptor(3).intercept_server_stream_sync(transport, None, _ctx())
    assert list(stream) == ["first", "second"]
    assert len(attempts) == 3


async def test_stream_retries_connect_failures_async():
    attempts = []

    async def transport(request, ctx):
        attempts.append(True)
        if len(attempts) < 3:
            raise _connect_error(Code.UNAVAILABLE, ConnectionError("tcp connect error"))
        yield "first"
        yield "second"

    stream = RetryInterceptor(3).intercept_server_stream(transport, None, _ctx())
    assert [message async for message in stream] == ["first", "second"]
    assert len(attempts) == 3


def test_stream_does_not_retry_after_request_was_sent():
    # A WriteError means the connection was up — the request may have reached
    # envd and started the command, so replaying it is not safe.
    attempts = []

    def transport(request, ctx):
        attempts.append(True)
        raise _connect_error(Code.UNAVAILABLE, WriteError("connection closed"))
        yield

    with pytest.raises(ConnectError):
        list(RetryInterceptor(3).intercept_server_stream_sync(transport, None, _ctx()))
    assert len(attempts) == 1


def test_stream_does_not_retry_after_first_message():
    attempts = []

    def transport(request, ctx):
        attempts.append(True)
        yield "first"
        raise _connect_error(Code.UNAVAILABLE, ConnectionError("dropped"))

    stream = RetryInterceptor(3).intercept_server_stream_sync(transport, None, _ctx())
    assert next(stream) == "first"
    with pytest.raises(ConnectError):
        next(stream)
    assert len(attempts) == 1


def test_stream_raises_when_connect_retries_are_exhausted():
    attempts = []

    def transport(request, ctx):
        attempts.append(True)
        raise _connect_error(Code.UNAVAILABLE, ConnectionError("tcp connect error"))
        yield

    with pytest.raises(ConnectError):
        list(RetryInterceptor(3).intercept_server_stream_sync(transport, None, _ctx()))
    # `retries` extra attempts after the first, matching the unary behavior.
    assert len(attempts) == 4
