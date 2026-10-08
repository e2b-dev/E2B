import asyncio

from typing import Awaitable, Callable, Optional
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from pyqwest import ReadError, StreamError, WriteError

from e2b.exceptions import (
    SandboxException,
    InvalidArgumentException,
    NotFoundException,
    SandboxNotRunningException,
    SandboxUnreachableException,
    TimeoutException,
    format_sandbox_unavailable_exception,
    is_sandbox_not_found_message,
    is_sandbox_port_not_open_message,
    AuthenticationException,
    RateLimitException,
)

_DEFAULT_RPC_ERROR_MAP: dict[Code, Callable[[str], Exception]] = {
    Code.INVALID_ARGUMENT: InvalidArgumentException,
    Code.UNAUTHENTICATED: AuthenticationException,
    Code.NOT_FOUND: NotFoundException,
    Code.UNAVAILABLE: format_sandbox_unavailable_exception,
    Code.RESOURCE_EXHAUSTED: lambda message: RateLimitException(
        f"{message}: Rate limit exceeded, please try again later."
    ),
    Code.CANCELED: lambda message: TimeoutException(
        f"{message}: The request was cancelled by the server or a proxy while it was in flight — for example when the sandbox is paused or shut down."
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


def is_ambiguous_unavailable(e: Exception) -> bool:
    """Whether the error is an ``UNAVAILABLE`` whose message the proxy's answers do
    not explain -- neither the sandbox not found nor its port not open -- e.g. envd
    ending a stream with "the connection to sandbox ... ended before the stream
    completed" when the sandbox is killed mid-command. Whether the sandbox is gone
    can only be told by probing it."""
    return (
        isinstance(e, ConnectError)
        and e.code is Code.UNAVAILABLE
        and not is_sandbox_not_found_message(e.message)
        and not is_sandbox_port_not_open_message(e.message)
    )


def format_terminated_exception(
    e: Exception,
    sandbox_running: Optional[bool],
) -> Exception:
    """Handle an exception for a request that failed at the connection level: when a
    sandbox health probe confirmed the sandbox is gone (``sandbox_running is False``),
    return a ``SandboxNotRunningException``; otherwise return the original error unchanged."""
    if sandbox_running is False:
        err = SandboxNotRunningException(
            f"{e}: The sandbox was killed or reached its end of life while the request was in flight."
        )
        err.__cause__ = e
        return err
    return e


def format_sandbox_unreachable_exception(
    e: Exception, probe_error: Exception
) -> Exception:
    """Build the exception for a request that failed at the connection level when the
    follow-up sandbox health probe failed too. A probe answered by the proxy with the
    sandbox running but envd's port not open is already a
    ``SandboxUnreachableException`` and is kept, with the failed request as its
    cause; otherwise the probe's failure is reported alongside the request's, which
    becomes the cause."""
    if isinstance(probe_error, SandboxUnreachableException):
        probe_error.__cause__ = e
        return probe_error
    err = SandboxUnreachableException(
        f"{e}: The sandbox could not be reached and its health probe failed too ({probe_error}). It was not confirmed to be stopped — this is likely a network issue or envd inside the sandbox not being up yet; check the sandbox state with 'Sandbox.get_info()'."
    )
    err.__cause__ = e
    return err


def handle_rpc_exception(
    e: Exception,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
    sandbox_running: Optional[bool] = None,
):
    """Handle errors from envd RPC calls by mapping gRPC status codes to specific exception types.

    :param e: The caught exception, expected to be a ``ConnectError``.
    :param error_map: Optional map of gRPC codes to exception factories that override the defaults.
    :param sandbox_running: Result of a sandbox health probe (``None`` when unknown), used to disambiguate a connection dropped mid-request or an ambiguous ``UNAVAILABLE``.
    :return: The corresponding exception. A connection dropped mid-request, or an ambiguous ``UNAVAILABLE``, with the sandbox confirmed gone becomes a ``SandboxNotRunningException``; non-``ConnectError`` errors are otherwise returned as-is.
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
        if is_transport_failure(e) or (
            sandbox_running is False and is_ambiguous_unavailable(e)
        ):
            return format_terminated_exception(e, sandbox_running)

        # Everything else maps by code; classifiable client-side failures
        # are typed at their source rather than sniffed from __cause__ here
        # (undecodable bodies: the envd codec; plain HTTP errors:
        # PlainHTTPErrorTransport).
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
    """Like :func:`handle_rpc_exception`, but when the request failed at the connection
    level (the connection to the sandbox could not be established or was dropped
    mid-request), or envd/the proxy answered an ``UNAVAILABLE`` that does not say
    whether the sandbox is gone (:func:`is_ambiguous_unavailable`), it probes the
    sandbox health to tell apart the sandbox being killed from the sandbox being
    unreachable or a transient network failure (e.g. a load balancer dropping the
    connection). When the probe confirms the sandbox is gone, a
    ``SandboxNotRunningException`` is returned; when the probe gets no answer either
    (the health check raises), a ``SandboxUnreachableException``; otherwise the error
    maps as usual (an ambiguous ``UNAVAILABLE`` to a ``SandboxUnreachableException``
    with the sandbox state unknown).
    """
    sandbox_running = None
    if check_health is not None and (
        is_transport_failure(e) or is_ambiguous_unavailable(e)
    ):
        try:
            sandbox_running = check_health()
        except Exception as probe_error:
            return format_sandbox_unreachable_exception(e, probe_error)
    return handle_rpc_exception(e, error_map, sandbox_running)


async def ahandle_rpc_exception_with_health(
    e: Exception,
    check_health: Optional[Callable[[], Awaitable[Optional[bool]]]] = None,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
):
    """Async version of :func:`handle_rpc_exception_with_health`."""
    sandbox_running = None
    if check_health is not None and (
        is_transport_failure(e) or is_ambiguous_unavailable(e)
    ):
        try:
            sandbox_running = await check_health()
        except Exception as probe_error:
            return format_sandbox_unreachable_exception(e, probe_error)
    return handle_rpc_exception(e, error_map, sandbox_running)
