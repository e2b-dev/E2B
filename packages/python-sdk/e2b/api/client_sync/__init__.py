from typing import Dict, Optional, Tuple, Union

import httpx
import threading

from pyqwest import SyncHTTPTransport, SyncRequest, SyncResponse
from pyqwest.httpx import PyqwestTransport
from pyqwest.middleware.retry import SyncRetryTransport

from e2b.api import (
    ApiClient,
    TransportConfig,
    connection_retries,
    make_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
)
from e2b.connection_config import READ_TIMEOUT, ConnectionConfig


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(config, transport=get_transport(config), **kwargs)


class ConnectionRetryTransport(SyncRetryTransport):
    """Retry only failures establishing the connection — shared by the REST
    API and envd RPC stacks: pyqwest raises the builtin ``ConnectionError``
    only before the request was written, so these retries can never replay a
    request the server may have received (a delivered REST call or unary RPC
    like ``SendInput``). This matches the connect-only ``retries`` of the
    httpx transports this replaced; the retry middleware's default policy
    would otherwise also retry I/O errors and 429/5xx responses for
    idempotent methods."""

    def should_retry_response(
        self, request: SyncRequest, response: Union[SyncResponse, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


def retrying_http_transport(
    transport: TransportConfig, read_timeout: Optional[float] = None
) -> ConnectionRetryTransport:
    """A fresh pyqwest transport (= its own connection pool) with the SDK's
    shared tuning — the proxy and TLS trust ``transport`` configures, the
    httpx-equivalent pool limits, and connect-only retries. The REST API, envd
    RPC, and envd HTTP API stacks each cache their own instances (pool
    unification is a follow-up).

    ``read_timeout`` bounds every read on the transport's connections; see
    :func:`get_envd_transport` for when that is (and isn't) appropriate.

    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    return ConnectionRetryTransport(
        SyncHTTPTransport(
            **transport.transport_kwargs(),
            pool_idle_timeout=pool_idle_timeout,
            pool_max_idle_per_host=pool_max_idle_per_host,
            read_timeout=read_timeout,
            # Redirects belong to the httpx client above (which the generated
            # clients leave off), not to reqwest.
            follow_redirects=False,
        ),
        max_retries=connection_retries,
    )


_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy and TLS trust; the default
# configuration is the direct pool. pyqwest transports are thread-safe, so
# unlike the httpx transports they replaced, the caches are process-global
# rather than per-thread.
_transports: Dict[TransportConfig, PyqwestTransport] = {}


def get_transport(config: ConnectionConfig) -> PyqwestTransport:
    """The shared pyqwest-backed httpx transport for REST API calls. For TLS
    connections ALPN negotiates the HTTP version (HTTP/2 against the E2B
    API), like the http2-enabled httpx transport this replaced."""
    key = TransportConfig.from_config(config)
    with _transport_lock:
        transport = _transports.get(key)
        if transport is None:
            transport = PyqwestTransport(retrying_http_transport(key))
            _transports[key] = transport
        return transport


# One transport per (connection options, streaming) pair, separate from the
# REST API pools — envd traffic goes to per-sandbox hosts.
_envd_transports: Dict[Tuple[TransportConfig, bool], PyqwestTransport] = {}


def get_envd_transport(
    config: ConnectionConfig, *, for_streaming: bool = False
) -> PyqwestTransport:
    """The shared pyqwest-backed httpx transports for the envd HTTP API
    (file transfers, health checks).

    The streaming transport carries ``read_timeout``, the idle bound on
    every read: it resets after each successful read, so it caps how long a
    streamed download may stall without limiting total transfer time. It is
    fixed per transport — the adapter's per-request timeouts are
    whole-request deadlines rather than idle bounds. Only streamed downloads
    use it: reqwest's read timer keeps
    running while a request body is sent and while waiting for the response
    head, so on the regular transport it would cut off uploads and slow
    unary responses longer than the idle bound (those stay bounded by their
    whole-request deadlines instead).
    """
    key = (TransportConfig.from_config(config), for_streaming)
    with _transport_lock:
        transport = _envd_transports.get(key)
        if transport is None:
            transport = PyqwestTransport(
                retrying_http_transport(
                    key[0],
                    read_timeout=READ_TIMEOUT if for_streaming else None,
                )
            )
            _envd_transports[key] = transport
        return transport


def get_envd_api(
    config: ConnectionConfig, base_url: str, *, for_streaming: bool = False
) -> httpx.Client:
    """An httpx client for a sandbox's envd HTTP API (file transfers, health
    checks) on the shared pyqwest transports. The client itself is a cheap
    stateless wrapper — one per consumer is fine — while the pooled transport
    underneath is shared and thread-safe."""
    return httpx.Client(
        base_url=base_url,
        transport=get_envd_transport(config, for_streaming=for_streaming),
        headers=config.sandbox_headers,
        event_hooks=make_logging_event_hooks(config.logger),
    )
