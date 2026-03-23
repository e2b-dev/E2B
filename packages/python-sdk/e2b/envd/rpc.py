import base64

from typing import Callable, Optional
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


def handle_rpc_exception(
    e: Exception,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
):
    """Handle errors from envd RPC calls by mapping gRPC status codes to specific exception types.

    :param e: The caught exception, expected to be a ``ConnectException``.
    :param error_map: Optional map of gRPC codes to exception factories that override the defaults.
    :return: The corresponding exception, or the original exception if not a ``ConnectException``.
    """
    if isinstance(e, ConnectException):
        if error_map and e.status in error_map:
            return error_map[e.status](e.message)

        if e.status in _DEFAULT_RPC_ERROR_MAP:
            return _DEFAULT_RPC_ERROR_MAP[e.status](e.message)

        return SandboxException(f"{e.status}: {e.message}")
    else:
        return e


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
