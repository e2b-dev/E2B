import httpx
import json

from typing import Callable, Optional

from e2b.exceptions import (
    SandboxException,
    RateLimitException,
    NotFoundException,
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    format_sandbox_timeout_exception,
)
from e2b.rate_limit import append_retry_after, parse_retry_after


ENVD_API_FILES_ROUTE = "/files"
ENVD_API_HEALTH_ROUTE = "/health"

_DEFAULT_API_ERROR_MAP: dict[int, Callable[[str], Exception]] = {
    400: InvalidArgumentException,
    401: AuthenticationException,
    404: NotFoundException,
    502: format_sandbox_timeout_exception,
    507: NotEnoughSpaceException,
}


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

    return format_envd_api_exception(
        res.status_code,
        get_message(res),
        error_map,
        retry_after_header=res.headers.get("Retry-After"),
    )


async def ahandle_envd_api_exception(
    res: httpx.Response,
    error_map: Optional[dict[int, Callable[[str], Exception]]] = None,
):
    """Async version of :func:`handle_envd_api_exception`."""
    if res.is_success:
        return

    await res.aread()

    return format_envd_api_exception(
        res.status_code,
        get_message(res),
        error_map,
        retry_after_header=res.headers.get("Retry-After"),
    )


def format_envd_api_exception(
    status_code: int,
    message: str,
    error_map: Optional[dict[int, Callable[[str], Exception]]] = None,
    retry_after_header: Optional[str] = None,
):
    """Map an HTTP status code and message to the appropriate exception.

    :param status_code: The HTTP status code.
    :param message: The error message from the response body.
    :param error_map: Optional map of HTTP status codes to exception factories that override the defaults.
    :return: The corresponding exception.
    """
    if error_map and status_code in error_map:
        return error_map[status_code](message)

    if status_code == 429:
        retry_after = parse_retry_after(retry_after_header)
        message = append_retry_after(
            f"{message}: The requests are being rate limited.",
            retry_after,
        )
        return RateLimitException(
            message,
            retry_after=retry_after,
            retry_after_header=retry_after_header,
        )

    if status_code in _DEFAULT_API_ERROR_MAP:
        return _DEFAULT_API_ERROR_MAP[status_code](message)

    return SandboxException(f"{status_code}: {message}")
