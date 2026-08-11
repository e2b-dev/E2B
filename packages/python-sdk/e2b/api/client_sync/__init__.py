from typing import Dict, Optional, Tuple, Union

import httpx
import threading

from pyqwest import SyncHTTPTransport, SyncRequest, SyncResponse
from pyqwest.httpx import PyqwestTransport
from pyqwest.middleware.retry import SyncRetryTransport

from e2b.api import (
    ApiClient,
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

    Retries cost memory on a streamed request body: to be able to replay it,
    the middleware copies the body in full as it is sent (reqwest reads ahead
    into it while connecting, so a connect error leaves the iterator already
    started and unrewindable). File uploads therefore skip this layer and go
    straight to the pool underneath — see :func:`get_upload_transport`."""

    def should_retry_response(
        self, request: SyncRequest, response: Union[SyncResponse, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


TransportKey = Tuple[Optional[ProxyConfig], Optional[float]]
"""Cache key of the shared transports: the proxy and the idle read bound."""

_transport_lock = threading.Lock()
# One pyqwest transport — one reqwest connection pool — per proxy and idle read
# bound; `None` is the direct pool. Every HTTP stack in the SDK draws from
# these: the control-plane REST API, the envd HTTP API, the envd RPC clients
# (`e2b.envd.client_sync`) and the volume content API (`e2b.volume.client_sync`).
# reqwest pools per host internally, so a single pool serves the API host and
# every per-sandbox host without interference — and because envd RPC and the
# envd HTTP API share it, a sandbox needs one HTTP/2 connection instead of one
# per stack.
#
# pyqwest transports are thread-safe, so unlike the httpx transports they
# replaced, the caches are process-global rather than per-thread.
_pools: Dict[TransportKey, SyncHTTPTransport] = {}
# The connect-retrying stack over each pool.
_transports: Dict[TransportKey, ConnectionRetryTransport] = {}
# The httpx adapter over each pool, shared by every httpx client on it — one per
# pool with the retries, one without for uploads.
_httpx_transports: Dict[TransportKey, PyqwestTransport] = {}
_upload_transports: Dict[TransportKey, PyqwestTransport] = {}


def get_pool(
    proxy: Optional[ProxyConfig], read_timeout: Optional[float] = None
) -> SyncHTTPTransport:
    """The shared connection pool with the SDK's tuning — system CA certs
    (without which TLS through an intercepting proxy fails) and the
    httpx-equivalent pool limits. For TLS connections ALPN negotiates the HTTP
    version (HTTP/2 against the E2B API and envd), like the http2-enabled httpx
    transports this replaced.

    Layer concerns above it rather than into it — connect retries wrap it, so
    does the RPC stack's plain-HTTP-error normalization, and headers and codecs
    are per-request — so that the pool stays shareable.

    ``read_timeout`` bounds every read on the pool's connections, which is why
    it is part of the cache key: reqwest's read timer keeps running while a
    request body is sent and while waiting for the response head, so a pool
    carrying one would cut off long uploads and slow responses. Only streamed
    downloads ask for it, as an idle bound (see :func:`get_transport`).

    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    key = (proxy, read_timeout)
    with _transport_lock:
        pool = _pools.get(key)
        if pool is None:
            pool = SyncHTTPTransport(
                tls_include_system_certs=True,
                proxy=proxy.to_pyqwest() if proxy is not None else None,
                pool_idle_timeout=pool_idle_timeout,
                pool_max_idle_per_host=pool_max_idle_per_host,
                read_timeout=read_timeout,
                # Redirects belong to the httpx client above (which the
                # generated clients leave off), not to reqwest.
                follow_redirects=False,
            )
            _pools[key] = pool
        return pool


def get_pyqwest_transport(
    proxy: Optional[ProxyConfig], read_timeout: Optional[float] = None
) -> ConnectionRetryTransport:
    """The shared pool of :func:`get_pool` behind connect-only retries, for
    consumers speaking pyqwest natively (the envd RPC clients). Consumers
    speaking httpx take :func:`get_httpx_transport`, the adapter over the very
    same stack."""
    key = (proxy, read_timeout)
    # Resolve the pool before taking the lock: it takes the same one.
    pool = get_pool(proxy, read_timeout)
    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = ConnectionRetryTransport(pool, max_retries=connection_retries)
            _transports[key] = transport
        return transport


def get_httpx_transport(
    proxy: Optional[ProxyConfig], read_timeout: Optional[float] = None
) -> PyqwestTransport:
    """The httpx adapter over the retrying stack of
    :func:`get_pyqwest_transport`, for the generated httpx clients (control
    plane, envd HTTP API, volume content). The adapter holds no state of its
    own and does not close the pool, so closing an httpx client leaves the
    pool intact for the other clients on it."""
    key = (proxy, read_timeout)
    stack = get_pyqwest_transport(proxy, read_timeout)
    with _transport_lock:
        transport = _httpx_transports.get(key)
        if transport is None:
            transport = PyqwestTransport(stack)
            _httpx_transports[key] = transport
        return transport


def get_upload_transport(
    proxy: Optional[ProxyConfig], read_timeout: Optional[float] = None
) -> PyqwestTransport:
    """The httpx adapter over the *same pool* as :func:`get_httpx_transport`
    but without the retry layer, for file uploads: envd ``files.write``, volume
    ``write_file`` and template context uploads.

    Those are the requests whose body is streamed rather than held in memory,
    and the retry middleware makes a body replayable by copying it in full as
    it is sent — so uploading a file on the retrying stack would mirror the
    whole file in RAM (SDK-332). Skipping the layer, not the pool, keeps the
    connection reuse: an upload still travels the sandbox's or the volume
    host's pooled connections. What it gives up is the connect retry, which
    fires before any of the body was written, so the caller sees the connection
    error and can retry the upload itself."""
    key = (proxy, read_timeout)
    pool = get_pool(proxy, read_timeout)
    with _transport_lock:
        transport = _upload_transports.get(key)
        if transport is None:
            transport = PyqwestTransport(pool)
            _upload_transports[key] = transport
        return transport


def get_transport(
    config: ConnectionConfig, *, for_streaming: bool = False, for_upload: bool = False
) -> PyqwestTransport:
    """The shared httpx transport for the control-plane REST API and the envd
    HTTP API (file transfers, health checks) — one pool serves both, keyed by
    the connection's proxy.

    ``for_streaming`` selects the pool carrying ``READ_TIMEOUT``, the idle
    bound on every read: it resets after each successful read, so it caps how
    long a streamed download may stall without limiting total transfer time.
    It is fixed per pool — the adapter's per-request timeouts are
    whole-request deadlines rather than idle bounds — so only streamed
    downloads take it, and they get their own pool (see :func:`get_pool`).

    ``for_upload`` selects the same pool without the retry layer, so that a
    streamed upload is not copied into memory to keep it replayable
    (see :func:`get_upload_transport`).
    """
    proxy = proxy_to_config(config.proxy)
    read_timeout = READ_TIMEOUT if for_streaming else None
    if for_upload:
        return get_upload_transport(proxy, read_timeout)
    return get_httpx_transport(proxy, read_timeout)


def get_envd_api(
    config: ConnectionConfig,
    base_url: str,
    *,
    for_streaming: bool = False,
    for_upload: bool = False,
) -> httpx.Client:
    """An httpx client for a sandbox's envd HTTP API (file transfers, health
    checks) on the shared transports. The client itself is a cheap stateless
    wrapper — one per consumer is fine — while the pooled transport underneath
    is shared and thread-safe."""
    return httpx.Client(
        base_url=base_url,
        transport=get_transport(
            config, for_streaming=for_streaming, for_upload=for_upload
        ),
        headers=config.sandbox_headers,
        event_hooks=make_logging_event_hooks(config.logger),
    )
