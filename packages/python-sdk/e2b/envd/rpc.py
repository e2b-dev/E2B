import base64

import httpcore
from typing import Awaitable, Callable, Optional
from packaging.version import Version
from e2b_connect.client import Code, ConnectException

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
    Code.invalid_argument: InvalidArgumentException,
    Code.unauthenticated: AuthenticationException,
    Code.not_found: NotFoundException,
    Code.unavailable: format_sandbox_timeout_exception,
    Code.resource_exhausted: lambda message: RateLimitException(
        f"{message}: Rate limit exceeded, please try again later."
    ),
    Code.canceled: lambda message: TimeoutException(
        f"{message}: This error is likely due to exceeding 'request_timeout'. You can pass the request timeout value as an option when making the request."
    ),
    Code.deadline_exceeded: lambda message: TimeoutException(
        f"{message}: This error is likely due to exceeding 'timeout' — the total time a long running request (like process or directory watch) can be active. It can be modified by passing 'timeout' when making the request. Use '0' to disable the timeout."
    ),
}


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

    :param e: The caught exception, expected to be a ``ConnectException`` or a transport-level ``httpcore`` error.
    :param error_map: Optional map of gRPC codes to exception factories that override the defaults.
    :param sandbox_running: Result of a sandbox health probe (``None`` when unknown), used to disambiguate a connection dropped mid-request.
    :return: The corresponding exception. A connection dropped mid-request with the sandbox confirmed gone becomes a ``TimeoutException``; non-``ConnectException`` errors are otherwise returned as-is.
    """
    if isinstance(e, ConnectException):
        if error_map and e.status in error_map:
            return error_map[e.status](e.message)

        if e.status in _DEFAULT_RPC_ERROR_MAP:
            return _DEFAULT_RPC_ERROR_MAP[e.status](e.message)

        return SandboxException(f"{e.status}: {e.message}")

    # A remote protocol error (e.g. an HTTP/2 stream reset) means the connection to the
    # sandbox was dropped mid-request — either the sandbox died or the network failed
    if isinstance(e, httpcore.RemoteProtocolError):
        return format_terminated_exception(e, sandbox_running)

    # A transport-level timeout from httpcore means a configured timeout was exceeded
    # before the server responded: `request_timeout` on a unary call's read phase, or
    # `connect`/`pool`/`write` on a stream's setup/send phase. Streams have no read
    # timeout — the command `timeout` is enforced server-side and surfaces as a
    # `deadline_exceeded` ConnectException instead. Unlike the JS SDK, where the
    # request timeout is an `AbortSignal` that connect normalizes into a `Code.canceled`
    # ConnectError, httpcore raises this raw transport error outside the ConnectException
    # path, so we map it here to a `TimeoutException` for a consistent timeout error.
    if isinstance(e, httpcore.TimeoutException):
        return TimeoutException(
            f"{e}: This error is likely due to exceeding 'timeout' — the total time a long running request (like process or directory watch) can be active — or 'request_timeout'. You can modify these by passing 'timeout' or 'request_timeout' when making the request. Use '0' to disable the timeout."
        )

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
    if check_health is not None and isinstance(e, httpcore.RemoteProtocolError):
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
    if check_health is not None and isinstance(e, httpcore.RemoteProtocolError):
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
