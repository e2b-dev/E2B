from functools import partial
from typing import Callable, Dict, Iterator, Optional, Tuple, Union

import httpx
import threading

from pyqwest import (
    HTTPVersion,
    SyncHTTPTransport,
    SyncRequest,
    SyncResponse,
    SyncTransport,
)
from pyqwest.httpx import PyqwestTransport
from pyqwest.middleware.retry import RetryMode, SyncRetryTransport

from e2b.api import (
    ApiClient,
    ConnectionBalancer,
    ProxyConfig,
    connection_retries,
    make_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.connection_config import READ_TIMEOUT, ConnectionConfig


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(config, transport=get_transport(config), **kwargs)


class ConnectionRetryTransport(SyncRetryTransport):
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

    def should_retry_request(self, request: SyncRequest) -> RetryMode:
        return RetryMode.UNBUFFERED

    def should_retry_response(
        self, request: SyncRequest, response: Union[SyncResponse, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


_Chunk = Union[bytes, bytearray, memoryview]


class _TrackedContent:
    """The content iterator of a balanced response: hands back the original
    response's chunks and releases its connection slot exactly once — when
    the content is exhausted, when the response is closed (``SyncResponse``
    forwards ``close`` to its content), when reading fails, or, failing all
    of those, when it is garbage collected."""

    __slots__ = ("_response", "_content", "_release")

    def __init__(self, response: SyncResponse, release: Callable[[], None]) -> None:
        self._response = response
        self._content = iter(response.content)
        self._release: Optional[Callable[[], None]] = release

    def __iter__(self) -> Iterator[_Chunk]:
        return self

    def __next__(self) -> _Chunk:
        try:
            return next(self._content)
        except BaseException:
            self.close()
            raise

    def close(self) -> None:
        if self._finish():
            self._response.close()

    def _finish(self) -> bool:
        release, self._release = self._release, None
        if release is None:
            return False
        release()
        return True

    def __del__(self) -> None:
        self.close()


class BalancingTransport(SyncTransport):
    """A pyqwest transport over a growable, bounded set of reqwest pools
    (see :class:`e2b.api.ConnectionBalancer`): each request runs on the pool
    with the fewest in flight and counts against it until its response is
    consumed or closed. Pools are built with ``build`` — the first eagerly,
    the rest as load requires — so they share every construction knob."""

    def __init__(self, build: Callable[[], SyncHTTPTransport]) -> None:
        self.balancer: ConnectionBalancer[SyncHTTPTransport] = ConnectionBalancer(build)

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        connection = self.balancer.acquire()
        try:
            response = connection.transport.execute_sync(request)
        except BaseException:
            self.balancer.release(connection)
            raise
        return SyncResponse(
            status=response.status,
            http_version=response.http_version,
            headers=response.headers,
            content=_TrackedContent(
                response, partial(self.balancer.release, connection)
            ),
            # Populated in place once the original content is consumed.
            trailers=response.trailers,
        )


_TransportKey = Tuple[Optional[ProxyConfig], Optional[float], bool]
"""Cache key: proxy, idle read bound, HTTP version — fixed when a pyqwest
transport is constructed, so each distinct combination is necessarily its own
transport."""

_transport_lock = threading.Lock()
# One balancing transport — a set of reqwest connection pools — per key; a
# `None` proxy is the direct transport. The REST API, envd RPC, envd HTTP API
# and volume stacks all draw from the same one for their proxy, so a sandbox's
# RPC and HTTP traffic multiplex over the same connections instead of opening
# one per stack.
#
# pyqwest transports are thread-safe, so unlike the httpx transports they
# replaced, the caches are process-global rather than per-thread.
_transports: Dict[_TransportKey, ConnectionRetryTransport] = {}
# The httpx adapter over each transport, shared by every httpx client on it.
_httpx_transports: Dict[_TransportKey, PyqwestTransport] = {}


def get_pyqwest_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http2: bool = True,
) -> ConnectionRetryTransport:
    """The shared pyqwest transport with the SDK's tuning — system CA certs
    (without which TLS through an intercepting proxy fails) and the
    httpx-equivalent pool limits — behind connect-only retries. It balances
    requests over as many reqwest connection pools as the load needs (see
    :class:`BalancingTransport`), so long-running streams do not all queue
    behind one HTTP/2 connection's concurrent-stream limit.

    Consumers speaking pyqwest natively (the envd RPC clients) take this;
    consumers speaking httpx take :func:`get_httpx_transport`, the adapter over
    the very same transport. Layer concerns above it rather than into it — the
    RPC stack's plain-HTTP-error normalization wraps it, headers and codecs are
    per-request — so that the pools stay shareable.

    ``read_timeout`` bounds every read on the pools' connections and ``http2``
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
    key = (proxy, read_timeout, http2)

    def build() -> SyncHTTPTransport:
        return SyncHTTPTransport(
            tls_include_system_certs=True,
            proxy=proxy.to_pyqwest() if proxy is not None else None,
            pool_idle_timeout=pool_idle_timeout,
            pool_max_idle_per_host=pool_max_idle_per_host,
            read_timeout=read_timeout,
            # `None` leaves the version to ALPN on TLS connections (HTTP/2
            # against the E2B API and envd) and uses HTTP/1 for plaintext,
            # like the http2-enabled httpx transport this replaced.
            http_version=None if http2 else HTTPVersion.HTTP1,
            # Redirects belong to the httpx client above (which the generated
            # clients leave off), not to reqwest.
            follow_redirects=False,
        )

    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = ConnectionRetryTransport(
                BalancingTransport(build), max_retries=connection_retries
            )
            _transports[key] = transport
        return transport


def get_httpx_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http2: bool = True,
) -> PyqwestTransport:
    """The httpx adapter over the shared transport of
    :func:`get_pyqwest_transport`, for the generated httpx clients (control
    plane, envd HTTP API, volume content). The adapter holds no state of its
    own and does not close the pools, so closing an httpx client leaves them
    intact for the other clients on it."""
    key = (proxy, read_timeout, http2)
    # Resolve the pool before taking the lock: it takes the same one.
    pool = get_pyqwest_transport(proxy, read_timeout, http2)
    with _transport_lock:
        transport = _httpx_transports.get(key)
        if transport is None:
            transport = PyqwestTransport(pool)
            _httpx_transports[key] = transport
        return transport


def get_transport(
    config: ConnectionConfig,
    http2: bool = True,
    *,
    for_streaming: bool = False,
) -> PyqwestTransport:
    """The shared httpx transport factory for the control-plane REST API and
    envd HTTP API (file transfers, health checks). For TLS connections ALPN
    negotiates the HTTP version (HTTP/2 against the E2B API), like the
    http2-enabled httpx transport this replaced.

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
    )


def get_envd_api(
    config: ConnectionConfig, base_url: str, *, for_streaming: bool = False
) -> httpx.Client:
    """An httpx client for a sandbox's envd HTTP API (file transfers, health
    checks) on the shared transports. The client itself is a cheap stateless
    wrapper — one per consumer is fine — while the pooled transport underneath
    is shared and thread-safe."""
    return httpx.Client(
        base_url=base_url,
        transport=get_transport(config, for_streaming=for_streaming),
        headers=config.sandbox_headers,
        event_hooks=make_logging_event_hooks(config.logger),
    )
