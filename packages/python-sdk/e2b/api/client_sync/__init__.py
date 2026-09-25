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

from e2b.retry import RetryableTransport
from e2b.api import (
    ApiClient,
    EnvdPoolBalancer,
    ProxyConfig,
    connection_retries,
    envd_pool_balancer,
    make_logging_event_hooks,
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


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport=RetryableTransport(get_transport(config), config.retries),
        **kwargs,
    )


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


class _TrackedContent:
    """A pooled response's body, counted in flight on its pool until it is
    fully read, fails, or is closed — whichever comes first, released once.
    Closing closes the pooled response, which is what cancels an HTTP/2 stream
    a consumer abandons early (see :func:`e2b.envd.client_sync.as_stream`)."""

    def __init__(self, response: SyncResponse, release: Callable[[], None]):
        self._response = response
        self._content = iter(response.content)
        self._release: Optional[Callable[[], None]] = release

    def __iter__(self) -> Iterator[Union[bytes, bytearray, memoryview]]:
        return self

    def __next__(self) -> Union[bytes, bytearray, memoryview]:
        try:
            return next(self._content)
        except BaseException:
            self._settle()
            raise

    def close(self) -> None:
        self._settle()
        self._response.close()

    def _settle(self) -> None:
        release, self._release = self._release, None
        if release is not None:
            release()


class EnvdPoolTransport:
    """The envd transport: a set of connection pools opened on demand, each
    request sent on the least-loaded one (see
    :class:`e2b.api.EnvdPoolBalancer`). Pools are the cached transports of
    :func:`get_pyqwest_transport`, so each brings the connect-only retries.

    The response is re-wrapped so the body's lifetime — not just the response
    head — is what holds the pool's slot: a running command's stream stays
    counted until it ends. pyqwest responses cannot be subclassed, so the
    wrapper is a fresh ``SyncResponse`` over the original head, body and
    (shared, filled on completion) trailers."""

    def __init__(
        self,
        open_pool: Callable[[int], SyncTransport],
        balancer: EnvdPoolBalancer,
    ):
        self.open_pool = open_pool
        self.balancer = balancer

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        index = self.balancer.acquire()
        try:
            response = self.open_pool(index).execute_sync(request)
        except BaseException:
            self.balancer.release(index)
            raise
        return SyncResponse(
            status=response.status,
            http_version=response.http_version,
            headers=response.headers,
            content=_TrackedContent(response, lambda: self.balancer.release(index)),
            trailers=response.trailers,
        )


_TransportKey = Tuple[Optional[ProxyConfig], Optional[float], HttpVersion, int]
"""Cache key: proxy, idle read bound, HTTP version, connection-pool shard.

The first three are fixed when a pyqwest transport is constructed. The shard
allows bounded parallel HTTP/2 connections to the stable envd host. Each
distinct combination is necessarily its own pool."""

_EnvdPoolKey = Tuple[Optional[ProxyConfig], Optional[float], HttpVersion]
"""Cache key of the envd transports: a :class:`_TransportKey` without the
shard, which the balancer picks per request."""

_transport_lock = threading.Lock()
# One pyqwest transport — one reqwest connection pool — per key; a `None` proxy
# is the direct pool. Generic API and volume traffic use shard zero. Envd
# traffic goes through `EnvdPoolTransport`, which opens further shards as the
# ones in use fill up; envd RPC and HTTP share those, so a process with light
# traffic keeps a single connection to the sandbox host.
#
# pyqwest transports are thread-safe, so unlike the httpx transports they
# replaced, the caches are process-global rather than per-thread.
_transports: Dict[_TransportKey, ConnectionRetryTransport] = {}
# The httpx adapter over each pool, shared by every httpx client on it.
_httpx_transports: Dict[_TransportKey, PyqwestTransport] = {}
_envd_transports: Dict[_EnvdPoolKey, EnvdPoolTransport] = {}
_envd_httpx_transports: Dict[_EnvdPoolKey, PyqwestTransport] = {}


def get_pyqwest_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http_version: HttpVersion = DEFAULT_HTTP_VERSION,
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

    ``read_timeout`` bounds every read on the pool's connections and
    ``http_version`` fixes the HTTP version; both are part of the cache key
    because they are transport-construction knobs, so one pool cannot serve
    two values of either. reqwest's read timer keeps running while a request body is sent and
    while waiting for the response head, so a pool carrying one would cut off
    long uploads and slow responses — only streamed downloads ask for it, as an
    idle bound (see :func:`get_transport`).

    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    key = (proxy, read_timeout, http_version, pool_shard)
    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = ConnectionRetryTransport(
                SyncHTTPTransport(
                    tls_include_system_certs=True,
                    proxy=proxy.to_pyqwest() if proxy is not None else None,
                    pool_idle_timeout=pool_idle_timeout,
                    pool_max_idle_per_host=pool_max_idle_per_host,
                    read_timeout=read_timeout,
                    # `None` leaves the version to ALPN on TLS connections
                    # (HTTP/2 against the E2B API and envd) and uses HTTP/1 for
                    # plaintext, like the http2-enabled httpx transport this
                    # replaced.
                    http_version=HTTPVersion.HTTP1 if http_version == "http1" else None,
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
    http_version: HttpVersion = DEFAULT_HTTP_VERSION,
) -> PyqwestTransport:
    """The httpx adapter over the shared pool of
    :func:`get_pyqwest_transport`, for the generated httpx clients (control
    plane, volume content). The adapter holds no state of its own and does not
    close the pool, so closing an httpx client leaves the pool intact for the
    other clients on it."""
    key = (proxy, read_timeout, http_version, 0)
    # Resolve the pool before taking the lock: it takes the same one.
    pool = get_pyqwest_transport(proxy, read_timeout, http_version)
    with _transport_lock:
        transport = _httpx_transports.get(key)
        if transport is None:
            transport = PyqwestTransport(pool)
            _httpx_transports[key] = transport
        return transport


def get_envd_pyqwest_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http_version: HttpVersion = DEFAULT_HTTP_VERSION,
) -> EnvdPoolTransport:
    """The shared envd transport for the given tuning: the envd RPC clients
    take it directly, the envd HTTP API through :func:`get_envd_httpx_transport`,
    so both draw on the same pools and load counts. Its pools are the shards
    of :func:`get_pyqwest_transport` with the same tuning, sized by
    :func:`e2b.api.envd_pool_balancer`."""
    key = (proxy, read_timeout, http_version)
    with _transport_lock:
        transport = _envd_transports.get(key)
        if transport is None:
            transport = EnvdPoolTransport(
                lambda shard: get_pyqwest_transport(
                    proxy, read_timeout, http_version, shard
                ),
                envd_pool_balancer(http_version),
            )
            _envd_transports[key] = transport
        return transport


def get_envd_httpx_transport(
    proxy: Optional[ProxyConfig],
    read_timeout: Optional[float] = None,
    http_version: HttpVersion = DEFAULT_HTTP_VERSION,
) -> PyqwestTransport:
    """The httpx adapter over :func:`get_envd_pyqwest_transport`, for the
    generated envd HTTP API clients."""
    key = (proxy, read_timeout, http_version)
    pool = get_envd_pyqwest_transport(proxy, read_timeout, http_version)
    with _transport_lock:
        transport = _envd_httpx_transports.get(key)
        if transport is None:
            transport = PyqwestTransport(pool)
            _envd_httpx_transports[key] = transport
        return transport


def get_transport(
    config: ConnectionConfig,
    http_version: Optional[HttpVersion] = None,
    *,
    for_streaming: bool = False,
) -> PyqwestTransport:
    """The shared httpx transport factory for the control-plane REST API;
    :func:`get_envd_transport` is its counterpart for the envd HTTP API. For
    TLS connections ALPN negotiates the HTTP version (HTTP/2 against the E2B
    API), like the http2-enabled httpx transport this replaced.

    ``http_version`` defaults to the config's ``http_version`` option;
    ``"http1"`` returns a separate transport (its own pool) pinned to
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
        config.http_version if http_version is None else http_version,
    )


def get_envd_transport(
    config: ConnectionConfig,
    http_version: Optional[HttpVersion] = None,
    *,
    for_streaming: bool = False,
) -> PyqwestTransport:
    """The envd HTTP API's transport (file transfers, health checks), on the
    load-balanced envd pools rather than the control plane's single pool.

    ``http_version`` defaults to the config's ``http_version`` option;
    ``"http1"`` pins the envd traffic to HTTP/1.1 (see :func:`get_transport`
    for what that changes). ``for_streaming`` selects the read-timeout-keyed
    pools, as for :func:`get_transport`.
    """
    return get_envd_httpx_transport(
        proxy_to_config(config.proxy),
        READ_TIMEOUT if for_streaming else None,
        config.http_version if http_version is None else http_version,
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
        transport=get_envd_transport(config, for_streaming=for_streaming),
        headers=config.sandbox_headers,
        event_hooks=make_logging_event_hooks(config.logger),
    )
