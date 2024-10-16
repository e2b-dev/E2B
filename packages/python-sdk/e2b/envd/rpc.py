import base64

from typing import Optional
from e2b_connect.client import Code, ConnectException

from e2b.exceptions import (
    SandboxException,
    InvalidArgumentException,
    NotFoundException,
    TimeoutException,
    format_sandbox_timeout_exception,
    AuthenticationException,
)
from e2b.connection_config import Username, default_username


def handle_rpc_exception(e: Exception):
    if isinstance(e, ConnectException):
        if e.status == Code.invalid_argument:
            return InvalidArgumentException(e.message)
        elif e.status == Code.unauthenticated:
            return AuthenticationException(e.message)
        elif e.status == Code.not_found:
            return NotFoundException(e.message)
        elif e.status == Code.unavailable:
            return format_sandbox_timeout_exception(e.message)
        elif e.status == Code.canceled:
            return TimeoutException(
                f"{e.message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request."
            )
        elif e.status == Code.deadline_exceeded:
            return TimeoutException(
                f"{e.message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request (like process or directory watch) can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout."
            )
        else:
            return SandboxException(f"{e.status}: {e.message}")
    else:
        return e


def authentication_header(user: Optional[Username] = None):
    value = f"{user if user is not None else default_username}:"

    encoded = base64.b64encode(value.encode("utf-8")).decode("utf-8")

    return {"Authorization": f"Basic {encoded}"}
