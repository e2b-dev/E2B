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


class ApiPyqwestTransport(PyqwestTransport):
    """The SDK's tweaks on the stock pyqwest httpx adapter.

    Strip the ``Host`` header httpx adds to every request: hyper derives
    HTTP/1 ``Host`` and HTTP/2 ``:authority`` from the URL itself, and
    forwarding an explicit ``host`` header on an HTTP/2 connection makes the
    E2B API edge reset the stream with PROTOCOL_ERROR. (Custom ``Host``
    overrides are therefore not honored, matching hyper's URL-derived
    behavior.)

    Re-raise pyqwest's timeouts (the builtin ``TimeoutError``) as
    ``httpx.ReadTimeout``, preserving the ``httpx.TimeoutException`` contract
    the httpx-native transport gave callers."""

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        if "host" in request.headers:
            del request.headers["host"]
        try:
            return super().handle_request(request)
        except TimeoutError as e:
            raise httpx.ReadTimeout(str(e), request=request) from e


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
    proxy: Optional[ProxyConfig],
) -> ConnectionRetryTransport:
    """A fresh pyqwest transport (= its own connection pool) with the SDK's
    shared tuning — system CA certs (without which TLS through an
    intercepting proxy fails), the httpx-equivalent pool limits, and
    connect-only retries. The REST API and envd RPC stacks each cache their
    own instances (pool unification is a follow-up).
    Requests are logged by pyqwest itself on the ``pyqwest.access`` and
    ``pyqwest`` loggers at ``DEBUG`` (off unless enabled) — the transport-level
    diagnostics httpcore used to provide. The SDK's own ``logger`` option is
    separate and sits above this, on the httpx client."""
    return ConnectionRetryTransport(
        SyncHTTPTransport(
            tls_include_system_certs=True,
            proxy=proxy.to_pyqwest() if proxy is not None else None,
            pool_idle_timeout=pool_idle_timeout,
            pool_max_idle_per_host=pool_max_idle_per_host,
        ),
        max_retries=connection_retries,
    )


_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
# pyqwest transports are thread-safe, so unlike the httpx envd transports
# below, the cache is process-global rather than per-thread.
_transports: Dict[Optional[ProxyConfig], "ApiPyqwestTransport"] = {}


def get_transport(config: ConnectionConfig) -> "ApiPyqwestTransport":
    """The shared pyqwest-backed httpx transport for REST API calls. For TLS
    connections ALPN negotiates the HTTP version (HTTP/2 against the E2B
    API), like the http2-enabled httpx transport this replaced."""
    proxy = proxy_to_config(config.proxy)
    with _transport_lock:
        transport = _transports.get(proxy)
        if transport is None:
            transport = ApiPyqwestTransport(retrying_http_transport(proxy))
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
