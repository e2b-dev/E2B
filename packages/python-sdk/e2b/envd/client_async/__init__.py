"""Async envd RPC clients: shared pyqwest transports and client factory."""

import asyncio
import threading
from typing import Any, AsyncGenerator, AsyncIterator, Callable, Optional, TypeVar, cast

from connectrpc.code import Code
from connectrpc.errors import ConnectError
from pyqwest import Client, HTTPTransport

from e2b.connection_config import ConnectionConfig
from e2b.envd.client_shared import (
    ENVD_JSON_CODEC,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
)
from e2b.envd.interceptors import build_interceptors
from e2b.exceptions import TimeoutException

RES = TypeVar("RES")
TClient = TypeVar("TClient")

_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
_transports: dict[Optional[str], HTTPTransport] = {}


def get_transport(proxy_url: Optional[str]) -> HTTPTransport:
    with _transport_lock:
        transport = _transports.get(proxy_url)
        if transport is None:
            transport = HTTPTransport(
                tls_include_system_certs=True,
                proxy=proxy_url,
                pool_idle_timeout=pool_idle_timeout,
                pool_max_idle_per_host=pool_max_idle_per_host,
            )
            _transports[proxy_url] = transport
        return transport


def create_rpc_client(
    client_cls: Callable[..., TClient],
    base_url: str,
    config: ConnectionConfig,
) -> TClient:
    """Build a generated async connectrpc client (e.g. ``ProcessClient``)
    wired with the shared pyqwest transport, the envd JSON codec, and the
    SDK's default-header/retry/logging interceptors.

    Compression is disabled in both directions to match the previous
    transport; envd's handling of compressed streaming bodies is unresolved.
    """
    http_client = Client(get_transport(proxy_to_url(config.proxy)))
    return client_cls(
        base_url,
        codec=ENVD_JSON_CODEC,
        send_compression=None,
        accept_compression=(),
        interceptors=build_interceptors(config, base_url),
        http_client=http_client,
    )


def as_stream(events: AsyncIterator[RES]) -> AsyncGenerator[RES, Any]:
    """The generated stubs type server streams as ``AsyncIterator``, but
    connectrpc returns real async generators — the SDK relies on ``aclose()``
    to cancel a stream early (hyper then resets the HTTP/2 stream)."""
    return cast("AsyncGenerator[RES, Any]", events)


def _request_timeout_exception(request_timeout: float) -> TimeoutException:
    return TimeoutException(
        f"Request timed out: the stream didn't open within 'request_timeout' "
        f"({request_timeout} seconds). You can pass the request timeout value "
        "as an option when making the request. Use '0' to disable it."
    )


async def first_event(
    events: AsyncGenerator[RES, Any], request_timeout: Optional[float]
) -> RES:
    """Wait for the event that opens a server stream (start/connect/watch),
    bounding the wait — connection setup, request write, and envd sending the
    event — by ``request_timeout``. This mirrors the JS SDK's
    ``requestTimeoutMs`` timer on streaming calls, which is disarmed once the
    stream is open; the rest of the stream is bounded only by the call's
    ``timeout_ms``. On timeout the caller's ``aclose()`` finds the stream
    already torn down (hyper resets the HTTP/2 stream when the cancellation
    unwinds connectrpc's response scope).
    """
    if not request_timeout:
        return await events.__anext__()
    try:
        return await asyncio.wait_for(events.__anext__(), request_timeout)
    except (asyncio.TimeoutError, TimeoutError) as e:
        raise _request_timeout_exception(request_timeout) from e
    except ConnectError as e:
        # wait_for's expiry cancels the __anext__ task, but connectrpc
        # converts the delivered CancelledError into ConnectError(CANCELED)
        # before wait_for can turn it into TimeoutError. A caller cancelling
        # the surrounding task surfaces identically, so tell the two apart by
        # the pending-cancellation count: wait_for uncancels its own expiry,
        # an external cancel stays pending. (Python 3.10 has no cancelling(),
        # but its wait_for re-raises external cancels before this point, so
        # reaching here without it means the timer expired.)
        cancelling = getattr(asyncio.current_task(), "cancelling", None)
        if (
            e.code is Code.CANCELED
            and isinstance(e.__cause__, asyncio.CancelledError)
            and (cancelling is None or cancelling() == 0)
        ):
            raise _request_timeout_exception(request_timeout) from e
        raise
