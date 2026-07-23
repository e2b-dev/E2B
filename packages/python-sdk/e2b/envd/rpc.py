import asyncio

from typing import Awaitable, Callable, Optional
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from pyqwest import ReadError, StreamError, WriteError

from e2b.exceptions import (
    SandboxException,
    InvalidArgumentException,
    NotFoundException,
    TimeoutException,
    format_sandbox_timeout_exception,
    AuthenticationException,
    RateLimitException,
)

_DEFAULT_RPC_ERROR_MAP: dict[Code, Callable[[str], Exception]] = {
    Code.INVALID_ARGUMENT: InvalidArgumentException,
    Code.UNAUTHENTICATED: AuthenticationException,
    Code.NOT_FOUND: NotFoundException,
    Code.UNAVAILABLE: format_sandbox_timeout_exception,
    Code.RESOURCE_EXHAUSTED: lambda message: RateLimitException(
        f"{message}: Rate limit exceeded, please try again later."
    ),
    Code.CANCELED: lambda message: TimeoutException(
        f"{message}: This error is likely due to exceeding 'request_timeout'. You can pass the request timeout value as an option when making the request."
    ),
    Code.DEADLINE_EXCEEDED: lambda message: TimeoutException(
        f"{message}: This error is likely due to exceeding 'timeout' — the total time a long running request (like process or directory watch) can be active — or 'request_timeout'. You can modify these by passing 'timeout' or 'request_timeout' when making the request. Use '0' to disable the timeout."
    ),
}


# pyqwest raises the builtin ConnectionError for connection-establishment
# failures and TimeoutError for its transport timeouts (both OSError
# subclasses); failures after the connection is up raise its ReadError /
# WriteError / StreamError (an HTTP/2 stream reset is a StreamError).
_TRANSPORT_ERRORS = (OSError, ReadError, WriteError, StreamError)


def is_transport_failure(e: Exception) -> bool:
    """Whether the error is a connection-level failure (failed connect, stream
    reset, connection dropped mid-request) rather than an error response from
    envd.

    connectrpc wraps transport errors with the original exception as
    ``__cause__``, but its catch-all wraps *any* unexpected exception the same
    way — including a response body that fails to decode — so the cause must
    actually be a transport error type, not merely present. Client-enforced
    deadlines (mapped to ``DEADLINE_EXCEEDED`` with a ``TimeoutError`` cause)
    are definitive results, not connection failures — they must not trigger
    a sandbox health probe.
    """
    return (
        isinstance(e, ConnectError)
        and isinstance(e.__cause__, _TRANSPORT_ERRORS)
        and e.code is not Code.DEADLINE_EXCEEDED
    )


def format_terminated_exception(
    e: Exception,
    sandbox_running: Optional[bool],
) -> Exception:
    """Handle an exception for a connection to the sandbox dropped mid-request: when a
    sandbox health probe confirmed the sandbox is gone (``sandbox_running is False``),
    return a ``TimeoutException``; otherwise return the original error unchanged."""
    if sandbox_running is False:
        return TimeoutException(
            f"{e}: The sandbox was killed or reached its end of life while the request was in flight."
        )
    return e


def handle_rpc_exception(
    e: Exception,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
    sandbox_running: Optional[bool] = None,
):
    """Handle errors from envd RPC calls by mapping gRPC status codes to specific exception types.

    :param e: The caught exception, expected to be a ``ConnectError``.
    :param error_map: Optional map of gRPC codes to exception factories that override the defaults.
    :param sandbox_running: Result of a sandbox health probe (``None`` when unknown), used to disambiguate a connection dropped mid-request.
    :return: The corresponding exception. A connection dropped mid-request with the sandbox confirmed gone becomes a ``TimeoutException``; non-``ConnectError`` errors are otherwise returned as-is.
    """
    if isinstance(e, ConnectError):
        # connectrpc converts asyncio cancellation into a ConnectError with
        # code CANCELED; restore the original CancelledError so cancelling a
        # task keeps its asyncio semantics instead of surfacing as an RPC
        # error (or, via the CANCELED mapping below, a TimeoutException).
        if isinstance(e.__cause__, asyncio.CancelledError):
            return e.__cause__

        # A transport-level failure (e.g. an HTTP/2 stream reset) means the
        # connection to the sandbox was dropped mid-request — either the
        # sandbox died or the network failed — so the code mapping below,
        # which describes envd responses, doesn't apply.
        if is_transport_failure(e):
            return format_terminated_exception(e, sandbox_running)

        # Everything else maps by code. Client-side failures the SDK itself
        # can classify are typed at their source instead of sniffed out of
        # ``__cause__`` here: an undecodable response body raises
        # ConnectError(INTERNAL) from the envd JSON codec (client_shared),
        # and plain (non-Connect-encoded) HTTP error responses arrive
        # already carrying the vendored client's status mapping — see
        # PlainHTTPErrorTransport in client_sync/client_async.
        if error_map and e.code in error_map:
            return error_map[e.code](e.message)

        if e.code in _DEFAULT_RPC_ERROR_MAP:
            return _DEFAULT_RPC_ERROR_MAP[e.code](e.message)

        return SandboxException(f"{e.code}: {e.message}")

    return e


def handle_rpc_exception_with_health(
    e: Exception,
    check_health: Optional[Callable[[], Optional[bool]]] = None,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
):
    """Like :func:`handle_rpc_exception`, but when the connection to the sandbox was
    dropped mid-request it probes the sandbox health to tell apart the sandbox being
    killed from a transient network failure (e.g. a load balancer dropping the connection).
    """
    sandbox_running = None
    if check_health is not None and is_transport_failure(e):
        try:
            sandbox_running = check_health()
        except Exception:
            sandbox_running = None
    return handle_rpc_exception(e, error_map, sandbox_running)


async def ahandle_rpc_exception_with_health(
    e: Exception,
    check_health: Optional[Callable[[], Awaitable[Optional[bool]]]] = None,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
):
    """Async version of :func:`handle_rpc_exception_with_health`."""
    sandbox_running = None
    if check_health is not None and is_transport_failure(e):
        try:
            sandbox_running = await check_health()
        except Exception:
            sandbox_running = None
    return handle_rpc_exception(e, error_map, sandbox_running)
