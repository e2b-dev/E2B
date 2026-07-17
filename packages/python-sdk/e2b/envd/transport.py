"""HTTP transport and connectrpc client plumbing for envd RPC calls.

The envd RPC clients (process, filesystem) run on `connectrpc`, whose HTTP
layer is `pyqwest` (Rust reqwest/hyper). This is a separate stack from the
`httpx` transports in `e2b.api`, which keep serving the REST API and the
multipart file transfer endpoints. Unlike the previous httpcore-based
transport, hyper sends RST_STREAM when a server stream is closed early, so
abandoned command/watch streams don't leak on the shared HTTP/2 connection.

Note: the per-request ``proxy`` option is not applied to RPC calls — pyqwest
only honors the standard ``http_proxy``/``https_proxy``/``all_proxy``
environment variables. File transfer and REST API requests still honor it.
"""

import logging
import os
import threading
from typing import (
    Any,
    AsyncGenerator,
    AsyncIterator,
    Awaitable,
    Callable,
    Generator,
    Iterator,
    Mapping,
    Optional,
    TypeVar,
    cast,
)

from connectrpc.errors import ConnectError
from connectrpc.request import RequestContext
from google.protobuf import json_format
from google.protobuf.message import Message
from pyqwest import Client, HTTPTransport, SyncClient, SyncHTTPTransport

from e2b.api import connection_retries
from e2b.connection_config import ConnectionConfig
from e2b.envd.rpc import is_transport_failure

REQ = TypeVar("REQ")
RES = TypeVar("RES")

_MESSAGE = TypeVar("_MESSAGE", bound=Message)


class _ProtoJSONCodec:
    """JSON codec matching the JS SDK's `useBinaryFormat: false`.

    Unknown response fields are ignored so an older SDK keeps working against
    a newer envd that added fields (the compat codec shipped with connectrpc
    fails hard on unknown fields).
    """

    def name(self) -> str:
        return "json"

    def encode(self, message: Message) -> bytes:
        return json_format.MessageToJson(message).encode("utf-8")

    def decode(self, data, message_class: type[_MESSAGE]) -> _MESSAGE:
        message = message_class()
        json_format.Parse(
            bytes(data).decode("utf-8"), message, ignore_unknown_fields=True
        )
        return message


ENVD_JSON_CODEC = _ProtoJSONCodec()


def as_stream(events: Iterator[RES]) -> Generator[RES, Any, None]:
    """The generated stubs type server streams as ``Iterator``, but connectrpc
    returns real generators — the SDK relies on ``close()`` to cancel a stream
    early (hyper then resets the HTTP/2 stream)."""
    return cast("Generator[RES, Any, None]", events)


def as_async_stream(events: AsyncIterator[RES]) -> AsyncGenerator[RES, Any]:
    """Async variant of :func:`as_stream`; the SDK relies on ``aclose()``."""
    return cast("AsyncGenerator[RES, Any]", events)


# Mirror the httpx pool tuning in `e2b.api.limits` with pyqwest's equivalents.
# `pool_max_idle_per_host` is per host rather than httpx's global idle cap,
# which suits envd traffic — each sandbox is its own host.
_pool_idle_timeout = float(os.getenv("E2B_KEEPALIVE_EXPIRY") or "300")
_pool_max_idle_per_host = int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS") or "20")

_transport_lock = threading.Lock()
_sync_transport: Optional[SyncHTTPTransport] = None
_async_transport: Optional[HTTPTransport] = None


def _get_sync_transport() -> SyncHTTPTransport:
    global _sync_transport
    with _transport_lock:
        if _sync_transport is None:
            _sync_transport = SyncHTTPTransport(
                pool_idle_timeout=_pool_idle_timeout,
                pool_max_idle_per_host=_pool_max_idle_per_host,
            )
        return _sync_transport


def _get_async_transport() -> HTTPTransport:
    global _async_transport
    with _transport_lock:
        if _async_transport is None:
            _async_transport = HTTPTransport(
                pool_idle_timeout=_pool_idle_timeout,
                pool_max_idle_per_host=_pool_max_idle_per_host,
            )
        return _async_transport


class _DefaultHeadersInterceptor:
    """Add default headers (User-Agent, sandbox access token) to every RPC.

    Implements both the sync and async metadata-interceptor protocols so one
    instance works with either client flavor. Per-call headers win.
    """

    def __init__(self, headers: Mapping[str, str]):
        self._headers = headers

    def _apply(self, ctx: RequestContext) -> None:
        for key, value in self._headers.items():
            if key not in ctx.request_headers:
                ctx.request_headers[key] = value

    def on_start_sync(self, ctx: RequestContext) -> None:
        self._apply(ctx)

    def on_end_sync(
        self, token: None, ctx: RequestContext, error: Optional[Exception]
    ) -> None:
        return

    async def on_start(self, ctx: RequestContext) -> None:
        self._apply(ctx)

    async def on_end(
        self, token: None, ctx: RequestContext, error: Optional[Exception]
    ) -> None:
        return


class _RetryInterceptor:
    """Retry unary RPCs that failed on a connection-level error.

    Replaces the previous stack's retries: httpcore's transport `retries`
    (failed connects) and the vendored client's retry on
    `RemoteProtocolError` (connection dropped mid-request). Streams are
    deliberately not retried — replaying a stream would re-deliver events.
    """

    def __init__(self, retries: int):
        self._retries = retries

    def intercept_unary_sync(
        self,
        call_next: Callable[[REQ, RequestContext], RES],
        request: REQ,
        ctx: RequestContext,
    ) -> RES:
        for _ in range(self._retries):
            try:
                return call_next(request, ctx)
            except ConnectError as e:
                if not is_transport_failure(e):
                    raise
        return call_next(request, ctx)

    async def intercept_unary(
        self,
        call_next: Callable[[REQ, RequestContext], Awaitable[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> RES:
        for _ in range(self._retries):
            try:
                return await call_next(request, ctx)
            except ConnectError as e:
                if not is_transport_failure(e):
                    raise
        return await call_next(request, ctx)


class _LoggingInterceptor:
    """Log RPC requests, responses, and stream messages to the user's logger.

    Requests and successful responses log at INFO, failures at ERROR and each
    streamed message at DEBUG — mirroring the httpx event hooks used for the
    REST API and file transfer requests.
    """

    def __init__(self, logger: logging.Logger, base_url: str):
        self._logger = logger
        self._base_url = base_url

    def _url(self, ctx: RequestContext) -> str:
        return f"{self._base_url}/{ctx.method.service_name}/{ctx.method.name}"

    def _log_request(self, ctx: RequestContext) -> None:
        self._logger.info(f"Request: POST {self._url(ctx)}")

    def _log_response(self, ctx: RequestContext, error: Optional[Exception]) -> None:
        if error is None:
            self._logger.info(f"Response: ok {self._url(ctx)}")
        else:
            code = error.code.name.lower() if isinstance(error, ConnectError) else error
            self._logger.error(f"Response: {code} {self._url(ctx)}")

    def _log_stream_message(self, ctx: RequestContext) -> None:
        self._logger.debug(f"Response stream: {self._url(ctx)}")

    def intercept_unary_sync(
        self,
        call_next: Callable[[REQ, RequestContext], RES],
        request: REQ,
        ctx: RequestContext,
    ) -> RES:
        self._log_request(ctx)
        try:
            response = call_next(request, ctx)
        except Exception as e:
            self._log_response(ctx, e)
            raise
        self._log_response(ctx, None)
        return response

    async def intercept_unary(
        self,
        call_next: Callable[[REQ, RequestContext], Awaitable[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> RES:
        self._log_request(ctx)
        try:
            response = await call_next(request, ctx)
        except Exception as e:
            self._log_response(ctx, e)
            raise
        self._log_response(ctx, None)
        return response

    def intercept_server_stream_sync(
        self,
        call_next: Callable[[REQ, RequestContext], Iterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> Iterator[RES]:
        self._log_request(ctx)
        try:
            for message in call_next(request, ctx):
                self._log_stream_message(ctx)
                yield message
        except Exception as e:
            self._log_response(ctx, e)
            raise
        self._log_response(ctx, None)

    async def intercept_server_stream(
        self,
        call_next: Callable[[REQ, RequestContext], AsyncIterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> AsyncIterator[RES]:
        self._log_request(ctx)
        try:
            async for message in call_next(request, ctx):
                self._log_stream_message(ctx)
                yield message
        except Exception as e:
            self._log_response(ctx, e)
            raise
        self._log_response(ctx, None)


def _build_interceptors(config: ConnectionConfig, base_url: str) -> list:
    # Retry sits inside the headers interceptor and outside logging, so each
    # retry attempt is logged like the previous stack did.
    interceptors: list = [_DefaultHeadersInterceptor(config.sandbox_headers)]
    interceptors.append(_RetryInterceptor(connection_retries))
    if config.logger is not None:
        interceptors.append(_LoggingInterceptor(config.logger, base_url))
    return interceptors


TClient = TypeVar("TClient")


def create_rpc_client(
    client_cls: Callable[..., TClient],
    base_url: str,
    config: ConnectionConfig,
    *,
    sync: bool,
) -> TClient:
    """Build a generated connectrpc client (e.g. ``ProcessClientSync``) wired
    with the shared pyqwest transport, the envd JSON codec, and the SDK's
    default-header/retry/logging interceptors.

    Compression is disabled in both directions to match the previous
    transport; envd's handling of compressed streaming bodies is unresolved.
    """
    http_client = (
        SyncClient(_get_sync_transport()) if sync else Client(_get_async_transport())
    )
    return client_cls(
        base_url,
        codec=ENVD_JSON_CODEC,
        send_compression=None,
        accept_compression=(),
        interceptors=_build_interceptors(config, base_url),
        http_client=http_client,
    )
