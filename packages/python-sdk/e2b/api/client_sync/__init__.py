from typing import Dict, Optional, Tuple, Union

import httpx
import threading

from pyqwest import SyncHTTPTransport, SyncRequest, SyncResponse
from pyqwest.httpx import PyqwestTransport
from pyqwest.middleware.retry import SyncRetryTransport

from e2b.api import (
    ApiClient,
    connection_retries,
    make_logging_event_hooks,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
)
from e2b.connection_config import READ_TIMEOUT, ConnectionConfig


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(config, transport=get_transport(config), **kwargs)


class _SyncOnlyStream(httpx.SyncByteStream):
    """Present a dual sync/async httpx request stream as sync-only.

    httpx's ``MultipartStream`` (``files=`` uploads) implements both
    ``SyncByteStream`` and ``AsyncByteStream``; the stock adapter's content
    conversion matches ``AsyncByteStream`` first and raises
    ``TypeError("unreachable")`` from inside the body iterator, which
    surfaces as a ``WriteError`` mid-request."""

    def __init__(self, stream: httpx.SyncByteStream):
        self._stream = stream

    def __iter__(self):
        return iter(self._stream)

    def close(self) -> None:
        self._stream.close()


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
        stream = request.stream
        if (
            isinstance(stream, httpx.SyncByteStream)
            and isinstance(stream, httpx.AsyncByteStream)
            and not isinstance(stream, httpx.ByteStream)
        ):
            request.stream = _SyncOnlyStream(stream)
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
    proxy_url: Optional[str], read_timeout: Optional[float] = None
) -> ConnectionRetryTransport:
    """A fresh pyqwest transport (= its own connection pool) with the SDK's
    shared tuning — system CA certs (without which TLS through an
    intercepting proxy fails), the httpx-equivalent pool limits, and
    connect-only retries. The REST API, envd RPC, and envd HTTP API stacks
    each cache their own instances (pool unification is a follow-up).

    ``read_timeout`` bounds every read on the transport's connections; see
    :func:`get_envd_transport` for when that is (and isn't) appropriate."""
    return ConnectionRetryTransport(
        SyncHTTPTransport(
            tls_include_system_certs=True,
            proxy=proxy_url,
            pool_idle_timeout=pool_idle_timeout,
            pool_max_idle_per_host=pool_max_idle_per_host,
            read_timeout=read_timeout,
        ),
        max_retries=connection_retries,
    )


_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
# pyqwest transports are thread-safe, so unlike the httpx transports they
# replaced, the caches are process-global rather than per-thread.
_transports: Dict[Optional[str], "ApiPyqwestTransport"] = {}


def get_transport(config: ConnectionConfig) -> "ApiPyqwestTransport":
    """The shared pyqwest-backed httpx transport for REST API calls. For TLS
    connections ALPN negotiates the HTTP version (HTTP/2 against the E2B
    API), like the http2-enabled httpx transport this replaced."""
    proxy_url = proxy_to_url(config.proxy)
    with _transport_lock:
        transport = _transports.get(proxy_url)
        if transport is None:
            transport = ApiPyqwestTransport(retrying_http_transport(proxy_url))
            _transports[proxy_url] = transport
        return transport


# One transport per (proxy, streaming) pair, separate from the REST API
# pools — envd traffic goes to per-sandbox hosts.
_envd_transports: Dict[Tuple[Optional[str], bool], "ApiPyqwestTransport"] = {}


def get_envd_transport(
    config: ConnectionConfig, *, for_streaming: bool = False
) -> "ApiPyqwestTransport":
    """The shared pyqwest-backed httpx transports for the envd HTTP API
    (file transfers, health checks).

    The streaming transport carries ``read_timeout``, the idle bound on
    every read: it resets after each successful read, so it caps how long a
    streamed download may stall without limiting total transfer time. It is
    fixed per transport — the adapter's per-request timeouts are
    whole-request deadlines, and the sync adapter does not bound body reads
    at all. Only streamed downloads use it: reqwest's read timer keeps
    running while a request body is sent and while waiting for the response
    head, so on the regular transport it would cut off uploads and slow
    unary responses longer than the idle bound (those stay bounded by their
    whole-request deadlines instead).
    """
    proxy_url = proxy_to_url(config.proxy)
    key = (proxy_url, for_streaming)
    with _transport_lock:
        transport = _envd_transports.get(key)
        if transport is None:
            transport = ApiPyqwestTransport(
                retrying_http_transport(
                    proxy_url,
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
