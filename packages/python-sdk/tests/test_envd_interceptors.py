"""Interceptor behavior the SDK relies on but connectrpc doesn't guarantee:
closing a server stream early must reach the innermost (transport) generator
synchronously — hyper only sends RST_STREAM when its generator is closed, and
a stranded inner generator defers that to GC.
"""

import logging
from functools import partial

from connectrpc._interceptor_async import (
    MetadataInterceptor,
    resolve_interceptors as resolve_interceptors_async,
)
from connectrpc._interceptor_sync import (
    MetadataInterceptorSync,
    resolve_interceptors as resolve_interceptors_sync,
)
from unittest.mock import MagicMock

from e2b.connection_config import ConnectionConfig
from e2b.envd.interceptors import (
    DefaultHeadersInterceptor,
    build_interceptors,
)


def _ctx():
    ctx = MagicMock()
    ctx.request_headers = {}
    ctx.method.service_name = "svc"
    ctx.method.name = "method"
    return ctx


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
