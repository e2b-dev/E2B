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
from e2b.envd.rpc import is_transport_failure

REQ = TypeVar("REQ")
RES = TypeVar("RES")


class DefaultHeadersInterceptor:
    """Add default headers (User-Agent, sandbox access token) to every RPC.

    Per-call headers win.
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


class RetryInterceptor:
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


def build_interceptors(config: ConnectionConfig, base_url: str) -> list:
    # Retry sits inside the headers interceptor and outside logging, so each
    # retry attempt is logged like the previous stack did.
    interceptors: list = [DefaultHeadersInterceptor(config.sandbox_headers)]
    interceptors.append(RetryInterceptor(connection_retries))
    if config.logger is not None:
        interceptors.append(LoggingInterceptor(config.logger, base_url))
    return interceptors
