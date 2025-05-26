import http
import json

import httpx

from e2b.exceptions import (
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    NotFoundException,
    SandboxException,
    format_sandbox_timeout_exception,
)

ENVD_API_FILES_ROUTE = "/files"
ENVD_API_HEALTH_ROUTE = "/health"


def get_message(e: httpx.Response) -> str:
    try:
        message = e.json().get("message", e.text)
    except json.JSONDecodeError:
        message = e.text

    return message


def handle_envd_api_exception(res: httpx.Response):
    if res.is_success:
        return

    res.read()

    return format_envd_api_exception(res.status_code, get_message(res))


async def ahandle_envd_api_exception(res: httpx.Response):
    if res.is_success:
        return

    await res.aread()

    return format_envd_api_exception(res.status_code, get_message(res))


def format_envd_api_exception(status_code: int, message: str):
    if status_code == http.HTTPStatus.BAD_REQUEST:
        return InvalidArgumentException(message)
    elif status_code == http.HTTPStatus.UNAUTHORIZED:
        return AuthenticationException(message)
    elif status_code == http.HTTPStatus.NOT_FOUND:
        return NotFoundException(message)
    elif status_code == http.HTTPStatus.TOO_MANY_REQUESTS:
        return SandboxException(f"{message}: The requests are being rate limited.")
    elif status_code == http.HTTPStatus.BAD_GATEWAY:
        return format_sandbox_timeout_exception(message)
    elif status_code == http.HTTPStatus.INSUFFICIENT_STORAGE:
        return NotEnoughSpaceException(message)
    else:
        return SandboxException(f"{status_code}: {message}")
