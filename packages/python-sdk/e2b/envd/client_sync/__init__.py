"""Sync envd RPC clients: the plain-error transport layer and client factory."""

from typing import Any, Callable, Generator, Iterator, TypeVar, cast

from pyqwest import (
    SyncClient,
    SyncRequest,
    SyncResponse,
    SyncTransport,
)

from e2b.api import proxy_to_config
from e2b.api.client_sync import get_pyqwest_transport
from e2b.connection_config import ConnectionConfig
from e2b.envd.client_shared import (
    ENVD_JSON_CODEC,
    ENVD_RPC_COMPRESSION,
    plain_http_error,
)
from e2b.envd.interceptors import build_interceptors

RES = TypeVar("RES")
TClient = TypeVar("TClient")


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


def create_rpc_client(
    client_cls: Callable[..., TClient],
    base_url: str,
    config: ConnectionConfig,
) -> TClient:
    """Build a generated sync connectrpc client (e.g. ``ProcessClientSync``)
    wired with the shared pyqwest transport (which retries failed connects,
    see :class:`e2b.api.client_sync.ConnectionRetryTransport`), the envd JSON
    codec, and the SDK's default-header and logging interceptors. Compression
    is disabled (see ``ENVD_RPC_COMPRESSION``). The client is stateless per
    call and its connection pool is process-global, so one instance serves all
    threads.

    The plain-error normalization is the one RPC-only transport concern, so it
    wraps the shared pool per client instead of being cached with it — a
    stateless wrapper over the pool the envd HTTP API uses for the same
    sandbox, which is what lets both share a single HTTP/2 connection.
    connectrpc arms the per-call deadline around the transport, so retry
    backoff counts against the request timeout, and the normalization sits
    outside the retries so it converts the settled response once.
    """
    http_client = SyncClient(
        PlainHTTPErrorTransport(get_pyqwest_transport(proxy_to_config(config.proxy)))
    )
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
