import asyncio
import threading
import weakref
from typing import Dict, Optional, Tuple, Union

import httpx

from pyqwest import HTTPTransport, Request, Response
from pyqwest.httpx import AsyncPyqwestTransport
from pyqwest.middleware.retry import RetryTransport

from e2b.api import (
    AsyncApiClient,
    ProxyConfig,
    connection_retries,
    limits,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.connection_config import ConnectionConfig, ProxyTypes

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(config, transport=get_transport(config), **kwargs)


class ConnectionRetryTransport(RetryTransport):
    """Retry only failures establishing the connection, matching the
    connect-only ``retries`` of the httpx transport this replaced: pyqwest
    raises the builtin ``ConnectionError`` only before the request was
    written, so these retries can never replay a request the API may have
    received. The retry middleware's default policy would otherwise also
    retry I/O errors and 429/5xx responses for idempotent methods."""

    def should_retry_response(
        self, request: Request, response: Union[Response, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
# pyqwest's I/O runs on its own Rust runtime, so unlike the httpx envd
# transports below, the transport is not bound to an event loop and the
# cache is process-global rather than per-loop.
_transports: Dict[Optional[ProxyConfig], AsyncPyqwestTransport] = {}


def get_transport(config: ConnectionConfig) -> AsyncPyqwestTransport:
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
            transport = AsyncPyqwestTransport(
                ConnectionRetryTransport(
                    HTTPTransport(
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


class AsyncEnvdTransportWithLogger(httpx.AsyncHTTPTransport):
    # Keyed weakly by the event loop object itself, not id(loop) — CPython
    # reuses object ids, so a new loop could otherwise inherit a transport
    # bound to a previous, closed loop.
    _instances: weakref.WeakKeyDictionary[
        asyncio.AbstractEventLoop,
        Dict[TransportKey, "AsyncEnvdTransportWithLogger"],
    ] = weakref.WeakKeyDictionary()

    @property
    def pool(self):
        return self._pool


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncEnvdTransportWithLogger:
    loop = asyncio.get_running_loop()
    loop_instances = AsyncEnvdTransportWithLogger._instances.get(loop)
    if loop_instances is None:
        loop_instances = {}
        AsyncEnvdTransportWithLogger._instances[loop] = loop_instances

    key: TransportKey = (http2, config.proxy)
    transport = loop_instances.get(key)
    if transport is None:
        transport = AsyncEnvdTransportWithLogger(
            limits=limits,
            proxy=config.proxy,
            http2=http2,
            retries=connection_retries,
        )
        loop_instances[key] = transport

    return transport
