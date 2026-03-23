import httpx
import json

from e2b.exceptions import (
    SandboxException,
    NotFoundException,
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
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


def handle_envd_api_exception(
    res: httpx.Response,
    not_found_exception: type[NotFoundException] = NotFoundException,
):
    if res.is_success:
        return

    res.read()

    return format_envd_api_exception(
        res.status_code,
        get_message(res),
        not_found_exception=not_found_exception,
    )


async def ahandle_envd_api_exception(
    res: httpx.Response,
    not_found_exception: type[NotFoundException] = NotFoundException,
):
    if res.is_success:
        return

    await res.aread()

    return format_envd_api_exception(
        res.status_code,
        get_message(res),
        not_found_exception=not_found_exception,
    )


def format_envd_api_exception(
    status_code: int,
    message: str,
    not_found_exception: type[NotFoundException] = NotFoundException,
):
    if status_code == 400:
        return InvalidArgumentException(message)
    elif status_code == 401:
        return AuthenticationException(message)
    elif status_code == 404:
        return not_found_exception(message)
    elif status_code == 429:
        return SandboxException(f"{message}: The requests are being rate limited.")
    elif status_code == 502:
        return format_sandbox_timeout_exception(message)
    elif status_code == 507:
        return NotEnoughSpaceException(message)
    else:
        return SandboxException(f"{status_code}: {message}")
