import asyncio
import base64

from typing import Awaitable, Callable, Optional
from packaging.version import Version
from connectrpc.code import Code
from connectrpc.errors import ConnectError

from e2b.exceptions import (
    SandboxException,
    InvalidArgumentException,
    NotFoundException,
    TimeoutException,
    format_sandbox_timeout_exception,
    AuthenticationException,
    RateLimitException,
)
from e2b.connection_config import Username, default_username
from e2b.envd.versions import ENVD_DEFAULT_USER

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


def timeout_to_ms(timeout: Optional[float]) -> Optional[int]:
    """Convert a timeout in seconds to the ``timeout_ms`` connectrpc calls
    expect. ``None`` and ``0`` (timeout disabled) map to ``None`` — connectrpc
    treats a non-positive deadline as already expired."""
    if not timeout:
        return None
    return int(timeout * 1000)


def is_transport_failure(e: Exception) -> bool:
    """Whether the error is a connection-level failure (failed connect, stream
    reset, connection dropped mid-request) rather than an error response from
    envd.

    connectrpc wraps transport errors with the original exception as
    ``__cause__``, while errors parsed from an HTTP status or a stream's
    end-of-stream trailer are raised without a cause. Client-enforced
    deadlines (``TimeoutError``) and asyncio cancellation also carry a cause
    but are definitive results, not connection failures — they must not be
    retried or trigger a sandbox health probe.
    """
    return (
        isinstance(e, ConnectError)
        and e.__cause__ is not None
        and not isinstance(e.__cause__, asyncio.CancelledError)
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


def authentication_header(
    envd_version: Version, user: Optional[Username] = None
) -> dict[str, str]:
    if user is None and envd_version < ENVD_DEFAULT_USER:
        user = default_username

    if not user:
        return {}

    value = f"{user}:"

    encoded = base64.b64encode(value.encode("utf-8")).decode("utf-8")

    return {"Authorization": f"Basic {encoded}"}
