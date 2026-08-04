import asyncio
import threading
import weakref
from typing import AsyncIterator, Dict, Optional, Tuple, Union, cast

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


class AsyncApiPyqwestTransport(AsyncPyqwestTransport):
    """The SDK's tweaks on the stock pyqwest httpx adapter.

    Strip the ``Host`` header httpx adds to every request: hyper derives
    HTTP/1 ``Host`` and HTTP/2 ``:authority`` from the URL itself, and
    forwarding an explicit ``host`` header on an HTTP/2 connection makes the
    E2B API edge reset the stream with PROTOCOL_ERROR. (Custom ``Host``
    overrides are therefore not honored, matching hyper's URL-derived
    behavior.)

    Re-raise pyqwest's timeouts (the builtin ``TimeoutError``, and
    ``asyncio.TimeoutError`` from the adapter's deadline — distinct types
    until Python 3.11) as ``httpx.ReadTimeout``, preserving the
    ``httpx.TimeoutException`` contract the httpx-native transport gave
    callers."""

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if "host" in request.headers:
            del request.headers["host"]
        try:
            response = await super().handle_async_request(request)
        except (TimeoutError, asyncio.TimeoutError) as e:
            raise httpx.ReadTimeout(str(e), request=request) from e
        # The adapter returns once the response head arrives and httpx reads
        # the body afterwards, so a body that stalls times out beyond the
        # try above — the mapping has to follow the stream.
        response.stream = AsyncReadTimeoutByteStream(
            cast(httpx.AsyncByteStream, response.stream), request
        )
        return response


class AsyncReadTimeoutByteStream(httpx.AsyncByteStream):
    """Maps a timeout while reading the response body to ``httpx.ReadTimeout``,
    the way ``AsyncApiPyqwestTransport`` maps one while awaiting the head."""

    def __init__(self, stream: httpx.AsyncByteStream, request: httpx.Request) -> None:
        self._stream = stream
        self._request = request

    async def __aiter__(self) -> AsyncIterator[bytes]:
        try:
            async for chunk in self._stream:
                yield chunk
        except (TimeoutError, asyncio.TimeoutError) as e:
            raise httpx.ReadTimeout(str(e), request=self._request) from e

    async def aclose(self) -> None:
        await self._stream.aclose()


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
_transports: Dict[Optional[ProxyConfig], "AsyncApiPyqwestTransport"] = {}


def get_transport(config: ConnectionConfig) -> "AsyncApiPyqwestTransport":
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
            transport = AsyncApiPyqwestTransport(
                ConnectionRetryTransport(
                    HTTPTransport(
                        tls_include_system_certs=True,
                        proxy=proxy.to_pyqwest() if proxy is not None else None,
                        pool_idle_timeout=pool_idle_timeout,
                        pool_max_idle_per_host=pool_max_idle_per_host,
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
