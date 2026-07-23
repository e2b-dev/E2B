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

from e2b.api import connection_retries
from e2b.connection_config import ConnectionConfig
from e2b.envd.rpc import is_connect_failure, is_transport_failure

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


class RetryInterceptor:
    """Retry RPCs that failed on a connection-level error.

    Replaces the previous stack's retries: httpcore's transport `retries`
    (failed connects) and the vendored client's retry on
    `RemoteProtocolError` (connection dropped mid-request). Unary calls are
    retried on any transport failure. Streams are retried only on failures
    establishing the connection — before the request could have reached envd
    (see :func:`is_connect_failure`) and before the first message; replaying
    a delivered request could re-run the command or re-deliver events.
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

    def intercept_server_stream_sync(
        self,
        call_next: Callable[[REQ, RequestContext], Iterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> Iterator[RES]:
        for attempt in range(self._retries + 1):
            inner = call_next(request, ctx)
            try:
                first = next(inner)
            except StopIteration:
                return
            except ConnectError as e:
                if attempt == self._retries or not is_connect_failure(e):
                    raise
                continue
            try:
                yield first
                yield from inner
            finally:
                # Propagate early close so the transport resets the stream.
                _close_stream(inner)
            return

    async def intercept_server_stream(
        self,
        call_next: Callable[[REQ, RequestContext], AsyncIterator[RES]],
        request: REQ,
        ctx: RequestContext,
    ) -> AsyncIterator[RES]:
        for attempt in range(self._retries + 1):
            inner = call_next(request, ctx)
            try:
                first = await inner.__anext__()
            except StopAsyncIteration:
                return
            except ConnectError as e:
                if attempt == self._retries or not is_connect_failure(e):
                    raise
                continue
            try:
                yield first
                async for message in inner:
                    yield message
            finally:
                # Propagate early close so the transport resets the stream.
                await _aclose_stream(inner)
            return


class LoggingInterceptor:
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
    # Retry sits inside the headers interceptor and outside logging, so each
    # retry attempt is logged like the previous stack did.
    #
    # Every interceptor here either adds no generator layer around server
    # streams or explicitly propagates close()/aclose() to the inner stream —
    # the SDK relies on closing a stream early to reset it on the shared
    # HTTP/2 connection (see `as_stream` in client_sync/client_async).
    interceptors: list = [DefaultHeadersInterceptor(config.sandbox_headers)]
    interceptors.append(RetryInterceptor(connection_retries))
    if config.logger is not None:
        interceptors.append(LoggingInterceptor(config.logger, base_url))
    return interceptors
