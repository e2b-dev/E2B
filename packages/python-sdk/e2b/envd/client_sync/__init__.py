"""Sync envd RPC clients: shared pyqwest transports and client factory."""

import threading
from typing import Any, Callable, Generator, Iterator, Optional, TypeVar, Union, cast

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
    plain_http_error,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_url,
    should_retry_connection,
)
from e2b.envd.interceptors import build_interceptors

RES = TypeVar("RES")
TClient = TypeVar("TClient")

_transport_lock = threading.Lock()
# One transport (= one connection pool) per proxy; None is the direct pool.
_transports: dict[Optional[str], "PlainHTTPErrorTransport"] = {}


class PlainHTTPErrorTransport:
    """Raise plain (non-Connect-encoded) HTTP error responses — e.g. an edge
    proxy answering for envd — as ``ConnectError``; see
    :func:`e2b.envd.client_shared.plain_http_error` for the mapping and
    rationale."""

    def __init__(self, inner: SyncTransport):
        self._inner = inner

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        response = self._inner.execute_sync(request)
        if response.status < 400:
            return response
        body = bytearray()
        for chunk in response.content:
            body.extend(chunk)
        data = bytes(body)
        error = plain_http_error(
            response.status, response.headers.get("content-type", ""), data
        )
        if error is None:
            # Valid Connect error: hand back to connectrpc, body restored.
            return SyncResponse(
                status=response.status,
                headers=response.headers,
                content=data,
            )
        raise error


class ConnectionRetryTransport(SyncRetryTransport):
    """Retry only failures establishing the connection; see
    :func:`e2b.envd.client_shared.should_retry_connection` for the policy
    rationale."""

    def should_retry_response(
        self, request: SyncRequest, response: Union[SyncResponse, Exception]
    ) -> bool:
        return should_retry_connection(response)


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
    (see ``ENVD_RPC_COMPRESSION``). The client is stateless per call and its
    transport is process-global, so one instance serves all threads.
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
