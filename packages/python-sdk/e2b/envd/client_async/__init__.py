"""Async envd RPC clients: shared pyqwest transports and client factory."""

import threading
from typing import Any, AsyncGenerator, AsyncIterator, Callable, Optional, TypeVar, cast

from pyqwest import Client, HTTPTransport

from e2b.connection_config import ConnectionConfig
from e2b.envd.client_shared import (
    ENVD_JSON_CODEC,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
)
from e2b.envd.interceptors import build_interceptors

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
