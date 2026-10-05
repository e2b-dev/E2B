import threading
from typing import Dict, Optional, Tuple, Union

import httpx

from pyqwest import HTTPTransport, HTTPVersion, Request, Response
from pyqwest.httpx import AsyncPyqwestTransport
from pyqwest.middleware.retry import RetryMode, RetryTransport

from e2b.retry import AsyncRetryableTransport
from e2b.api import (
    AsyncApiClient,
    ProxyConfig,
    connection_retries,
    max_connections,
    make_async_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.connection_config import (
    DEFAULT_HTTP_VERSION,
    READ_TIMEOUT,
    ConnectionConfig,
    HttpVersion,
)


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        transport=AsyncRetryableTransport(get_transport(config), config.retries),
        **kwargs,
    )


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


_TransportKey = Tuple[Optional[ProxyConfig], Optional[float], HttpVersion]
"""Cache key: proxy, idle read bound, HTTP version — fixed when a pyqwest
transport is constructed, so each distinct combination is necessarily its own
transport."""

_transport_lock = threading.Lock()
# One transport — a reqwest connection pool — per key; a
# `None` proxy is the direct transport. The REST API, envd RPC, envd HTTP API
# and volume stacks all draw from the same one for their proxy, so a sandbox's
# RPC and HTTP traffic multiplex over the same connections instead of opening
# one per stack.
#
# pyqwest's I/O runs on its own Rust runtime, so unlike the httpx transports
# they replaced, the transports are not bound to an event loop and the caches
# are process-global rather than per-loop.
_transports: Dict[_TransportKey, ConnectionRetryTransport] = {}
# The httpx adapter over each transport, shared by every httpx client on it.
_httpx_transports: Dict[_TransportKey, AsyncPyqwestTransport] = {}


def get_pyqwest_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    *,
    http_version: HttpVersion = DEFAULT_HTTP_VERSION,
) -> ConnectionRetryTransport:
    """The shared pyqwest transport with the SDK's tuning — system CA certs
    (without which TLS through an intercepting proxy fails) and the
    httpx-equivalent pool limits — behind connect-only retries. pyqwest
    spreads each origin's HTTP/2 streams over as many connections as the
    server's concurrent-stream limit requires, up to ``max_connections`` per
    address, so long-running streams do not all queue behind one
    connection.

    Consumers speaking pyqwest natively (the envd RPC clients) take this;
    consumers speaking httpx take :func:`get_httpx_transport`, the adapter over
    the very same transport. Layer concerns above it rather than into it — the
    RPC stack's plain-HTTP-error normalization wraps it, headers and codecs are
    per-request — so that the pool stays shareable.

    ``read_timeout`` bounds every read on the pool's connections and
    ``http_version`` fixes the HTTP version; both are part of the cache key
    because they are transport-construction knobs, so one pool cannot serve two
    values of either. reqwest's read timer keeps running while a request body is sent and
    while waiting for the response head, so a pool carrying one would cut off
    long uploads and slow responses — only streamed downloads ask for it, as an
    idle bound (see :func:`get_transport`).

    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    key = (proxy, read_timeout, http_version)

    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = ConnectionRetryTransport(
                HTTPTransport(
                    tls_include_system_certs=True,
                    proxy=proxy.to_pyqwest() if proxy is not None else None,
                    pool_idle_timeout=pool_idle_timeout,
                    pool_max_idle_per_host=pool_max_idle_per_host,
                    max_connections_per_address=max_connections,
                    read_timeout=read_timeout,
                    # `None` leaves the version to ALPN on TLS connections (HTTP/2
                    # against the E2B API and envd) and uses HTTP/1 for plaintext,
                    # like the http2-enabled httpx transport this replaced.
                    http_version=HTTPVersion.HTTP1 if http_version == "1.1" else None,
                    # Redirects belong to the httpx client above (which the generated
                    # clients leave off), not to reqwest.
                    follow_redirects=False,
                ),
                max_retries=connection_retries,
            )
            _transports[key] = transport
        return transport


def get_httpx_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    *,
    http_version: HttpVersion = DEFAULT_HTTP_VERSION,
) -> AsyncPyqwestTransport:
    """The httpx adapter over the shared transport of
    :func:`get_pyqwest_transport`, for the generated httpx clients (control
    plane, envd HTTP API, volume content). The adapter holds no state of its
    own and does not close the pool, so closing an httpx client leaves it
    intact for the other clients on it."""
    key = (proxy, read_timeout, http_version)
    # Resolve the pool before taking the lock: it takes the same one.
    pool = get_pyqwest_transport(proxy, read_timeout, http_version=http_version)
    with _transport_lock:
        transport = _httpx_transports.get(key)
        if transport is None:
            transport = AsyncPyqwestTransport(pool)
            _httpx_transports[key] = transport
        return transport


def get_transport(
    config: ConnectionConfig,
    *,
    http_version: Optional[HttpVersion] = None,
    for_streaming: bool = False,
) -> AsyncPyqwestTransport:
    """The shared httpx transport factory for the control-plane REST API and
    envd HTTP API (file transfers, health checks). For TLS connections ALPN
    negotiates the HTTP version (HTTP/2 against the E2B API), like the
    http2-enabled httpx transport this replaced.

    ``http_version`` defaults to the config's ``http_version`` option;
    ``"1.1"`` returns a separate transport (its own pool) pinned to HTTP/1.1.
    That matters for a server that reacts to a client going away: HTTP/2
    multiplexes requests over one connection, so abandoning a request only
    resets its stream and the server may never notice, while HTTP/1.1's
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
        http_version=(config.http_version if http_version is None else http_version),
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
        transport=get_transport(config, for_streaming=for_streaming),
        headers=config.sandbox_headers,
        event_hooks=make_async_logging_event_hooks(config.logger),
    )
