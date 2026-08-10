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
    limits,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.connection_config import ConnectionConfig, ProxyTypes

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(config, transport=get_transport(config), **kwargs)


class ConnectionRetryTransport(SyncRetryTransport):
    """Retry only failures establishing the connection, matching the
    connect-only ``retries`` of the httpx transport this replaced: pyqwest
    raises the builtin ``ConnectionError`` only before the request was
    written, so these retries can never replay a request the API may have
    received. The retry middleware's default policy would otherwise also
    retry I/O errors and 429/5xx responses for idempotent methods."""

    def should_retry_response(
        self, request: SyncRequest, response: Union[SyncResponse, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
# pyqwest transports are thread-safe, so unlike the httpx envd transports
# below, the cache is process-global rather than per-thread.
_transports: Dict[Optional[ProxyConfig], PyqwestTransport] = {}


def get_transport(config: ConnectionConfig) -> PyqwestTransport:
    """The shared pyqwest-backed httpx transport for REST API calls. For TLS
    connections ALPN negotiates the HTTP version (HTTP/2 against the E2B
    API), like the http2-enabled httpx transport this replaced.

    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    proxy = proxy_to_config(config.proxy)
    with _transport_lock:
        transport = _transports.get(proxy)
        if transport is None:
            transport = PyqwestTransport(
                ConnectionRetryTransport(
                    SyncHTTPTransport(
                        tls_include_system_certs=True,
                        proxy=proxy.to_pyqwest() if proxy is not None else None,
                        pool_idle_timeout=pool_idle_timeout,
                        pool_max_idle_per_host=pool_max_idle_per_host,
                        # Redirects belong to the httpx client above (which the
                        # generated clients leave off), not to reqwest.
                        follow_redirects=False,
                    ),
                    max_retries=connection_retries,
                )
            )
            _transports[proxy] = transport
        return transport


class EnvdTransportWithLogger(httpx.HTTPTransport):
    _thread_local = threading.local()

    @property
    def pool(self):
        return self._pool


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> EnvdTransportWithLogger:
    instances: Dict[TransportKey, EnvdTransportWithLogger] = getattr(
        EnvdTransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = (http2, config.proxy)
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = EnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=connection_retries,
    )
    instances[key] = transport
    EnvdTransportWithLogger._thread_local.instances = instances
    return transport
