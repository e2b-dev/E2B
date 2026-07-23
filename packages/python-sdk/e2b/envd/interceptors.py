"""connectrpc interceptors for envd RPC calls.

Each interceptor implements both the sync and async connectrpc interceptor
protocols so one instance works with either client flavor.
"""

import logging
from typing import (
    AsyncIterator,
    Awaitable,
    Callable,
    Iterator,
    Mapping,
    Optional,
    TypeVar,
)

from connectrpc.errors import ConnectError
from connectrpc.request import RequestContext

from e2b.connection_config import ConnectionConfig

REQ = TypeVar("REQ")
RES = TypeVar("RES")


def _close_stream(stream: Iterator) -> None:
    """Close an inner server stream if it supports it (connectrpc streams are
    real generators; the protocols only promise ``Iterator``)."""
    close = getattr(stream, "close", None)
    if close is not None:
        close()


async def _aclose_stream(stream: AsyncIterator) -> None:
    """Async variant of :func:`_close_stream`."""
    aclose = getattr(stream, "aclose", None)
    if aclose is not None:
        await aclose()


class DefaultHeadersInterceptor:
    """Add default headers (User-Agent, sandbox access token) to every RPC.

    Per-call headers win.

    Implemented as the per-method-kind interceptor protocols rather than the
    simpler connectrpc metadata protocol: connectrpc wraps metadata
    interceptors around server streams in a generator that doesn't propagate
    ``close()``/``aclose()`` to the inner stream, which would defer the
    RST_STREAM the SDK relies on for early stream cancellation to the
    async-generator GC finalizer. Returning ``call_next``'s iterator directly
    adds no such layer.
    """

    def __init__(self, headers: Mapping[str, str]):
        self._headers = headers

    def _apply(self, ctx: RequestContext) -> None:
        for key, value in self._headers.items():
            if key not in ctx.request_headers:
                ctx.request_headers[key] = value

    def intercept_unary_sync(
        self,
        call_next: Callable[[REQ, RequestContext], RES],
        request: REQ,
        ctx: RequestContext,
    ) -> RES:
        self._apply(ctx)
        return call_next(request, ctx)

    async def intercept_unary(
        self,
        call_next: Callable[[REQ, RequestContext], Awaitable[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> RES:
        self._apply(ctx)
        return await call_next(request, ctx)

    def intercept_server_stream_sync(
        self,
        call_next: Callable[[REQ, RequestContext], Iterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> Iterator[RES]:
        self._apply(ctx)
        return call_next(request, ctx)

    def intercept_server_stream(
        self,
        call_next: Callable[[REQ, RequestContext], AsyncIterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> AsyncIterator[RES]:
        self._apply(ctx)
        return call_next(request, ctx)


class LoggingInterceptor:
    """Log RPC requests, responses, and stream messages to the user's logger.

    Requests and successful responses log at INFO, failures at ERROR and each
    streamed message at DEBUG — mirroring the httpx event hooks used for the
    REST API and file transfer requests.

    Upstreamed to pyqwest as a logging middleware
    (https://github.com/curioswitch/pyqwest/pull/192); this interceptor stays
    until that ships in a pyqwest release the SDK can depend on.
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
        inner = call_next(request, ctx)
        try:
            for message in inner:
                self._log_stream_message(ctx)
                yield message
        except Exception as e:
            self._log_response(ctx, e)
            raise
        finally:
            # Propagate early close: a bare `for ... yield` would strand the
            # inner stream when the consumer calls close(), deferring the
            # transport's stream reset to garbage collection.
            _close_stream(inner)
        self._log_response(ctx, None)

    async def intercept_server_stream(
        self,
        call_next: Callable[[REQ, RequestContext], AsyncIterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> AsyncIterator[RES]:
        self._log_request(ctx)
        inner = call_next(request, ctx)
        try:
            async for message in inner:
                self._log_stream_message(ctx)
                yield message
        except Exception as e:
            self._log_response(ctx, e)
            raise
        finally:
            # Propagate early close: a bare `async for ... yield` would strand
            # the inner stream when the consumer calls aclose(), deferring the
            # transport's stream reset to the async-generator GC finalizer.
            await _aclose_stream(inner)
        self._log_response(ctx, None)


def build_interceptors(config: ConnectionConfig, base_url: str) -> list:
    # Connection retries live below connectrpc, in the pyqwest transport
    # middleware (`ConnectionRetryTransport` in client_sync/client_async),
    # not in an interceptor.
    #
    # Every interceptor here either adds no generator layer around server
    # streams or explicitly propagates close()/aclose() to the inner stream —
    # the SDK relies on closing a stream early to reset it on the shared
    # HTTP/2 connection (see `as_stream` in client_sync/client_async).
    interceptors: list = [DefaultHeadersInterceptor(config.sandbox_headers)]
    if config.logger is not None:
        interceptors.append(LoggingInterceptor(config.logger, base_url))
    return interceptors
