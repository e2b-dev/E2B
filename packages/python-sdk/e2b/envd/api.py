import httpx

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


def handle_envd_api_exception(res: httpx.Response):
    if res.status_code == 400:
        return InvalidArgumentException(res.json().get("message"))
    elif res.status_code == 401:
        return AuthenticationException(res.json().get("message"))
    elif res.status_code == 404:
        return NotFoundException(res.json().get("message"))
    elif res.status_code == 429:
        return SandboxException(f"{res.text}: The requests are being rate limited.")
    elif res.status_code == 502:
        return format_sandbox_timeout_exception(res.text)
    elif res.status_code == 507:
        return NotEnoughSpaceException(res.json().get("message"))
    elif res.status_code >= 400:
        return SandboxException(f"{res.status_code}: {res.json().get('message')}")
    return None
