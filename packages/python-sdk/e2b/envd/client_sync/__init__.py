"""Sync envd RPC clients: shared pyqwest transports and client factory."""

import threading
from typing import Any, Callable, Generator, Iterator, Optional, TypeVar, Union, cast

from connectrpc.errors import ConnectError
from pyqwest import (
    SyncClient,
    SyncHTTPTransport,
    SyncRequest,
    SyncResponse,
    SyncTransport,
)
from pyqwest.middleware.retry import SyncRetryTransport

from e2b.api import connection_retries
from e2b.connection_config import ConnectionConfig
from e2b.envd.client_shared import (
    ENVD_JSON_CODEC,
    ENVD_RPC_COMPRESSION,
    plain_http_error_code,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
)
from e2b.envd.interceptors import build_interceptors

RES = TypeVar("RES")
TClient = TypeVar("TClient")

_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
_transports: dict[Optional[str], "PlainHTTPErrorTransport"] = {}


class PlainHTTPErrorTransport:
    """Raise plain (non-Connect-encoded) HTTP error responses — e.g. an edge
    proxy answering for envd — as ``ConnectError`` with the vendored client's
    status mapping and the response body as the message, before connectrpc
    collapses them into Connect-spec codes with synthesized reason phrases
    (404 → UNIMPLEMENTED "Not Found"): ``kill``/``exists``/``make_dir``
    branch on NOT_FOUND/ALREADY_EXISTS and user code relies on
    RateLimitException to back off. connectrpc re-raises a ``ConnectError``
    from the transport unchanged — the path its own protocol errors take.
    Error responses with a JSON content type are Connect-encoded; connectrpc
    parses those itself. Becomes unnecessary once connectrpc preserves the
    status on the errors it builds
    (https://github.com/connectrpc/connect-py/issues/306).
    """

    def __init__(self, inner: SyncTransport):
        self._inner = inner

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        response = self._inner.execute_sync(request)
        code = plain_http_error_code(
            response.status, response.headers.get("content-type", "")
        )
        if code is None:
            return response
        body = bytearray()
        for chunk in response.content:
            body.extend(chunk)
        message = bytes(body).decode("utf-8", "replace") or f"HTTP {response.status}"
        raise ConnectError(code, message)


class ConnectionRetryTransport(SyncRetryTransport):
    """Retry only failures establishing the connection.

    pyqwest raises the builtin ``ConnectionError`` only before the request
    was written, so retrying exactly these failures can never replay a
    request envd may have received — which could re-run a command or
    re-deliver events — for unary and streaming RPCs alike. Anything later
    (``WriteError``/``ReadError``/``StreamError``, error responses) surfaces
    to the caller; the middleware's default policy would otherwise also retry
    I/O errors and 429/5xx responses for idempotent methods. This replaces
    httpcore's transport ``retries`` from the previous stack and deliberately
    drops the vendored client's retry on connections dropped mid-request,
    which could re-execute a delivered unary RPC like ``SendInput``.
    """

    def should_retry_response(
        self, request: SyncRequest, response: Union[SyncResponse, Exception]
    ) -> bool:
        return isinstance(response, ConnectionError)


def get_transport(proxy_url: Optional[str]) -> "PlainHTTPErrorTransport":
    with _transport_lock:
        transport = _transports.get(proxy_url)
        if transport is None:
            # connectrpc arms the per-call deadline around the transport, so
            # retry backoff counts against the request timeout. The plain-
            # error normalization sits outside the retries so it converts
            # the settled response once.
            transport = PlainHTTPErrorTransport(
                ConnectionRetryTransport(
                    SyncHTTPTransport(
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


def create_rpc_client(
    client_cls: Callable[..., TClient],
    base_url: str,
    config: ConnectionConfig,
) -> TClient:
    """Build a generated sync connectrpc client (e.g. ``ProcessClientSync``)
    wired with the shared pyqwest transport (which retries failed connects,
    see :class:`ConnectionRetryTransport`), the envd JSON codec, and the
    SDK's default-header and logging interceptors. Compression is disabled
    (see ``ENVD_RPC_COMPRESSION``).
    """
    http_client = SyncClient(get_transport(proxy_to_url(config.proxy)))
    return client_cls(
        base_url,
        codec=ENVD_JSON_CODEC,
        interceptors=build_interceptors(config, base_url),
        http_client=http_client,
        **ENVD_RPC_COMPRESSION,
    )


def as_stream(events: Iterator[RES]) -> Generator[RES, Any, None]:
    """The generated stubs type server streams as ``Iterator``, but connectrpc
    returns real generators — the SDK relies on ``close()`` to cancel a stream
    early (hyper then resets the HTTP/2 stream)."""
    return cast("Generator[RES, Any, None]", events)
