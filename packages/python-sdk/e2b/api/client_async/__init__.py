import threading
from typing import Dict, Optional, Tuple, Union

import httpx

from pyqwest import HTTPTransport, HTTPVersion, Request, Response
from pyqwest.httpx import AsyncPyqwestTransport
from pyqwest.middleware.retry import RetryMode, RetryTransport

from e2b.api import (
    AsyncApiClient,
    ProxyConfig,
    connection_retries,
    envd_pool_shard,
    make_async_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.connection_config import READ_TIMEOUT, ConnectionConfig


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(config, transport=get_transport(config), **kwargs)


class ConnectionRetryTransport(RetryTransport):
    """Retry only failures establishing the connection — part of the shared
    transport stack, so it covers the REST API, the envd HTTP API, the envd RPC
    clients and the volume content API alike: pyqwest raises the builtin
    ``ConnectionError`` only before the request was written, so these retries
    can never replay a request the server may have received (a delivered REST
    call or unary RPC like ``SendInput``). This matches the connect-only
    ``retries`` of the httpx transports this replaced; the retry middleware's
    default policy would otherwise also retry I/O errors and 429/5xx responses
    for idempotent methods.

    Streamed request bodies stay unbuffered: the middleware would otherwise
    mirror them into memory as they are sent to keep them replayable, which a
    connect-only policy never needs — the body is untouched on every failure
    it retries. ``bytes`` bodies are replayable as they are in either mode."""

    def should_retry_request(self, request: Request) -> RetryMode:
        return RetryMode.UNBUFFERED

    def should_retry_response(
        self, request: Request, response: Union[Response, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


_TransportKey = Tuple[Optional[ProxyConfig], Optional[float], bool, int]
"""Cache key: proxy, idle read bound, HTTP version, connection-pool shard.

The first three are fixed when a pyqwest transport is constructed. The shard
allows bounded parallel HTTP/2 connections to the stable envd host. Each
distinct combination is necessarily its own pool."""

_transport_lock = threading.Lock()
# One pyqwest transport — one reqwest connection pool — per key; a `None` proxy
# is the direct pool. Generic API and volume traffic use shard zero. Envd RPC
# and non-streaming HTTP traffic for one sandbox use the same sandbox shard, so
# they share one HTTP/2 connection instead of opening one per stack.
#
# pyqwest's I/O runs on its own Rust runtime, so unlike the httpx transports
# they replaced, the transports are not bound to an event loop and the caches
# are process-global rather than per-loop.
_transports: Dict[_TransportKey, ConnectionRetryTransport] = {}
# The httpx adapter over each pool, shared by every httpx client on it.
_httpx_transports: Dict[_TransportKey, AsyncPyqwestTransport] = {}


def get_pyqwest_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http2: bool = True,
    pool_shard: int = 0,
) -> ConnectionRetryTransport:
    """The shared pyqwest transport (= one connection pool) with the SDK's
    tuning — system CA certs (without which TLS through an intercepting proxy
    fails) and the httpx-equivalent pool limits — behind connect-only retries.

    Consumers speaking pyqwest natively (the envd RPC clients) take this;
    consumers speaking httpx take :func:`get_httpx_transport`, the adapter over
    the very same pool. Layer concerns above it rather than into it — the RPC
    stack's plain-HTTP-error normalization wraps it, headers and codecs are
    per-request — so that the pool stays shareable.

    ``read_timeout`` bounds every read on the pool's connections and ``http2``
    fixes the HTTP version; both are part of the cache key because they are
    transport-construction knobs, so one pool cannot serve two values of
    either. reqwest's read timer keeps running while a request body is sent and
    while waiting for the response head, so a pool carrying one would cut off
    long uploads and slow responses — only streamed downloads ask for it, as an
    idle bound (see :func:`get_transport`).

    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    key = (proxy, read_timeout, http2, pool_shard)
    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = ConnectionRetryTransport(
                HTTPTransport(
                    tls_include_system_certs=True,
                    proxy=proxy.to_pyqwest() if proxy is not None else None,
                    pool_idle_timeout=pool_idle_timeout,
                    pool_max_idle_per_host=pool_max_idle_per_host,
                    read_timeout=read_timeout,
                    # `None` leaves the version to ALPN on TLS connections
                    # (HTTP/2 against the E2B API and envd) and uses HTTP/1 for
                    # plaintext, like the http2-enabled httpx transport this
                    # replaced.
                    http_version=None if http2 else HTTPVersion.HTTP1,
                    # Redirects belong to the httpx client above (which the
                    # generated clients leave off), not to reqwest.
                    follow_redirects=False,
                ),
                max_retries=connection_retries,
            )
            _transports[key] = transport
        return transport


def get_httpx_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http2: bool = True,
    pool_shard: int = 0,
) -> AsyncPyqwestTransport:
    """The httpx adapter over the shared pool of
    :func:`get_pyqwest_transport`, for the generated httpx clients (control
    plane, envd HTTP API, volume content). The adapter holds no state of its
    own and does not close the pool, so closing an httpx client leaves the
    pool intact for the other clients on it."""
    key = (proxy, read_timeout, http2, pool_shard)
    # Resolve the pool before taking the lock: it takes the same one.
    pool = get_pyqwest_transport(proxy, read_timeout, http2, pool_shard)
    with _transport_lock:
        transport = _httpx_transports.get(key)
        if transport is None:
            transport = AsyncPyqwestTransport(pool)
            _httpx_transports[key] = transport
        return transport


def get_transport(
    config: ConnectionConfig,
    http2: bool = True,
    *,
    for_streaming: bool = False,
    pool_shard: int = 0,
) -> AsyncPyqwestTransport:
    """The shared httpx transport factory for the control-plane REST API and
    envd HTTP API (file transfers, health checks). Generic callers use shard
    zero; :func:`get_envd_transport` supplies a sandbox-specific shard. For TLS
    connections ALPN negotiates the HTTP version (HTTP/2 against the E2B API),
    like the http2-enabled httpx transport this replaced.

    ``http2=False`` returns a separate transport (its own pool) pinned to
    HTTP/1.1. That matters for a server that reacts to a client going away:
    HTTP/2 multiplexes requests over one connection, so abandoning a request
    only resets its stream and the server may never notice, while HTTP/1.1's
    one-connection-per-request closes the connection and the server observes
    the disconnect.

    ``for_streaming`` selects the pool carrying ``READ_TIMEOUT``, the idle
    bound on every read: it resets after each successful read, so it caps how
    long a streamed download may stall without limiting total transfer time.
    It is fixed per pool — the adapter's per-request timeouts are
    whole-request deadlines rather than idle bounds — so only streamed
    downloads take it, and they get their own pool
    (see :func:`get_pyqwest_transport`).
    """
    return get_httpx_transport(
        proxy_to_config(config.proxy),
        READ_TIMEOUT if for_streaming else None,
        http2,
        pool_shard,
    )


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True, *, for_streaming: bool = False
) -> AsyncPyqwestTransport:
    """The envd HTTP API's transport, sharded by sandbox ID.

    Envd RPC and non-streaming HTTP traffic for one sandbox resolve the same
    shard, retaining their shared connection while spreading different
    sandboxes over a bounded number of connections to the stable sandbox host.
    Streaming HTTP traffic uses the same shard number with a separate
    read-timeout-keyed pool.

    Kept as a separate factory because generic API transports stay on shard
    zero while envd transports use the sandbox's shard.
    """
    return get_transport(
        config,
        http2,
        for_streaming=for_streaming,
        pool_shard=envd_pool_shard(config),
    )


def get_envd_api(
    config: ConnectionConfig, base_url: str, *, for_streaming: bool = False
) -> httpx.AsyncClient:
    """An httpx client for a sandbox's envd HTTP API (file transfers, health
    checks) on the shared transports. The client itself is a cheap stateless
    wrapper — one per consumer is fine — while the pooled transport underneath
    is shared and loop-independent."""
    return httpx.AsyncClient(
        base_url=base_url,
        transport=get_envd_transport(config, for_streaming=for_streaming),
        headers=config.sandbox_headers,
        event_hooks=make_async_logging_event_hooks(config.logger),
    )
