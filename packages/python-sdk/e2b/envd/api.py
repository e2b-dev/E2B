import httpx
import json

from typing import Callable, Optional

from e2b.envd.rpc import format_terminated_exception
from e2b.exceptions import (
    SandboxException,
    NotFoundException,
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    RateLimitException,
    format_sandbox_timeout_exception,
)


ENVD_API_FILES_ROUTE = "/files"
ENVD_API_HEALTH_ROUTE = "/health"

_DEFAULT_API_ERROR_MAP: dict[int, Callable[[str], Exception]] = {
    400: InvalidArgumentException,
    401: AuthenticationException,
    404: NotFoundException,
    429: lambda message: RateLimitException(
        f"{message}: The requests are being rate limited."
    ),
    502: format_sandbox_timeout_exception,
    507: NotEnoughSpaceException,
}


HEALTH_CHECK_TIMEOUT = 5  # seconds


def check_sandbox_health(envd_api: httpx.Client) -> Optional[bool]:
    """Probe the sandbox's envd health endpoint.

    :return: ``True`` if the sandbox is running, ``False`` if it is not, ``None`` if its state could not be determined.
    """
    try:
        r = envd_api.get(ENVD_API_HEALTH_ROUTE, timeout=HEALTH_CHECK_TIMEOUT)
        if r.status_code == 502:
            return False
        if r.is_success:
            return True
        return None
    except Exception:
        return None


async def acheck_sandbox_health(envd_api: httpx.AsyncClient) -> Optional[bool]:
    """Async version of :func:`check_sandbox_health`."""
    try:
        r = await envd_api.get(ENVD_API_HEALTH_ROUTE, timeout=HEALTH_CHECK_TIMEOUT)
        if r.status_code == 502:
            return False
        if r.is_success:
            return True
        return None
    except Exception:
        return None


def handle_envd_api_transport_exception(
    e: Exception,
    sandbox_running: Optional[bool] = None,
) -> Exception:
    """Handle transport-level errors from envd API requests.

    :param e: The caught exception, expected to be a transport-level ``httpx`` error.
    :param sandbox_running: Result of a sandbox health probe (``None`` when unknown), used to disambiguate a connection dropped mid-request.
    :return: A ``TimeoutException`` when the connection dropped mid-request and the sandbox is confirmed gone, or the original exception unchanged otherwise.
    """
    # A remote protocol error (e.g. an HTTP/2 stream reset) means the connection to the
    # sandbox was dropped mid-request — either the sandbox died or the network failed
    if isinstance(e, httpx.RemoteProtocolError):
        return format_terminated_exception(e, sandbox_running)

    return e


def handle_envd_api_transport_exception_with_health(
    e: Exception,
    envd_api: httpx.Client,
) -> Exception:
    """Like :func:`handle_envd_api_transport_exception`, but when the connection to the
    sandbox was dropped mid-request it probes the sandbox health to tell apart the sandbox
    being killed from a transient network failure (e.g. a load balancer dropping the connection).
    """
    sandbox_running = (
        check_sandbox_health(envd_api)
        if isinstance(e, httpx.RemoteProtocolError)
        else None
    )
    return handle_envd_api_transport_exception(e, sandbox_running)


async def ahandle_envd_api_transport_exception_with_health(
    e: Exception,
    envd_api: httpx.AsyncClient,
) -> Exception:
    """Async version of :func:`handle_envd_api_transport_exception_with_health`."""
    sandbox_running = (
        await acheck_sandbox_health(envd_api)
        if isinstance(e, httpx.RemoteProtocolError)
        else None
    )
    return handle_envd_api_transport_exception(e, sandbox_running)


def get_message(e: httpx.Response) -> str:
    try:
        message = e.json().get("message", e.text)
    except json.JSONDecodeError:
        message = e.text

    return message


def handle_envd_api_exception(
    res: httpx.Response,
    error_map: Optional[dict[int, Callable[[str], Exception]]] = None,
):
    """Handle errors from envd API responses by mapping HTTP status codes to specific exception types.

    :param res: The HTTP response.
    :param error_map: Optional map of HTTP status codes to exception factories that override the defaults.
    :return: The corresponding exception, or ``None`` if the response is successful.
    """
    if res.is_success:
        return

    res.read()

    return format_envd_api_exception(res.status_code, get_message(res), error_map)


async def ahandle_envd_api_exception(
    res: httpx.Response,
    error_map: Optional[dict[int, Callable[[str], Exception]]] = None,
):
    """Async version of :func:`handle_envd_api_exception`."""
    if res.is_success:
        return

    await res.aread()

    return format_envd_api_exception(res.status_code, get_message(res), error_map)


def format_envd_api_exception(
    status_code: int,
    message: str,
    error_map: Optional[dict[int, Callable[[str], Exception]]] = None,
):
    """Map an HTTP status code and message to the appropriate exception.

    :param status_code: The HTTP status code.
    :param message: The error message from the response body.
    :param error_map: Optional map of HTTP status codes to exception factories that override the defaults.
    :return: The corresponding exception.
    """
    if error_map and status_code in error_map:
        return error_map[status_code](message)

    if status_code in _DEFAULT_API_ERROR_MAP:
        return _DEFAULT_API_ERROR_MAP[status_code](message)

    return SandboxException(f"{status_code}: {message}")
