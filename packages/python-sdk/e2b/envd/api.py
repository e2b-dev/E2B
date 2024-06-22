import requests
from e2b.exceptions import (
    SandboxException,
    InvalidUserException,
    InvalidPathException,
    NotFoundException,
    NotEnoughDiskSpaceException,
    format_sandbox_timeout_exception,
)


ENVD_API_FILES_ROUTE = "/files"


# TODO: Improve the messages
def handle_envd_api_exception(res: requests.Response):
    if res.status_code == 400:
        return InvalidUserException(res.json().get("message"))
    elif res.status_code == 403:
        return InvalidPathException(res.json().get("message"))
    elif res.status_code == 404:
        return NotFoundException(res.json().get("message"))
    elif res.status_code == 412:
        return InvalidPathException(res.json().get("message"))
    elif res.status_code == 502:
        return format_sandbox_timeout_exception(res.json().get("message"))
    elif res.status_code == 507:
        return NotEnoughDiskSpaceException(res.json().get("message"))
    elif res.status_code >= 400:
        return SandboxException(f"{res.status_code}: {res.json().get('message')}")
    return None
