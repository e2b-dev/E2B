import asyncio
import threading
import weakref
from typing import Dict, Optional, Tuple, Union

import httpx

from httpx._types import ProxyTypes
from pyqwest import HTTPTransport, Request, Response
from pyqwest.httpx import AsyncPyqwestTransport
from pyqwest.middleware.retry import RetryTransport

from e2b.api import (
    AsyncApiClient,
    connection_retries,
    limits,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
)
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        async_transport_factory=lambda: get_transport(config),
        **kwargs,
    )


class AsyncApiPyqwestTransport(AsyncPyqwestTransport):
    """Strip the ``Host`` header httpx adds to every request: hyper derives
    HTTP/1 ``Host`` and HTTP/2 ``:authority`` from the URL itself, and
    forwarding an explicit ``host`` header on an HTTP/2 connection makes the
    E2B API edge reset the stream with PROTOCOL_ERROR. (Custom ``Host``
    overrides are therefore not honored, matching hyper's URL-derived
    behavior.)"""

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if "host" in request.headers:
            del request.headers["host"]
        return await super().handle_async_request(request)


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
_transports: Dict[Optional[str], "AsyncApiPyqwestTransport"] = {}


def get_transport(config: ConnectionConfig) -> "AsyncApiPyqwestTransport":
    """The shared pyqwest-backed httpx transport for REST API calls. For TLS
    connections ALPN negotiates the HTTP version (HTTP/2 against the E2B
    API), like the http2-enabled httpx transport this replaced."""
    proxy_url = proxy_to_url(config.proxy)
    with _transport_lock:
        transport = _transports.get(proxy_url)
        if transport is None:
            transport = AsyncApiPyqwestTransport(
                ConnectionRetryTransport(
                    HTTPTransport(
                        tls_include_system_certs=True,
                        proxy=proxy_url,
                        pool_idle_timeout=pool_idle_timeout,
                        pool_max_idle_per_host=pool_max_idle_per_host,
                    ),
                    max_retries=connection_retries,
                )
            )
            _transports[proxy_url] = transport
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
