import base64

from typing import Callable, Optional
from packaging.version import Version
from connectrpc.code import Code
from google.protobuf.json_format import MessageToJson, Parse
from google.protobuf.message import Message
from connectrpc.errors import ConnectError
from connectrpc.request import RequestContext

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

STREAM_REQUEST_TIMEOUT_HEADER = "E2B-Stream-Request-Timeout"

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
        f"{message}: This error is likely due to exceeding 'timeout' — the total time a long running request (like process or directory watch) can be active. It can be modified by passing 'timeout' when making the request. Use '0' to disable the timeout."
    ),
}


def handle_rpc_exception(
    e: Exception,
    error_map: Optional[dict[Code, Callable[[str], Exception]]] = None,
):
    """Handle errors from envd RPC calls by mapping gRPC status codes to specific exception types.

    :param e: The caught exception, expected to be a ``ConnectError``.
    :param error_map: Optional map of gRPC codes to exception factories that override the defaults.
    :return: The corresponding exception, or the original exception if not a ``ConnectError``.
    """
    if isinstance(e, ConnectError):
        if error_map and e.code in error_map:
            return error_map[e.code](e.message)

        if e.code in _DEFAULT_RPC_ERROR_MAP:
            return _DEFAULT_RPC_ERROR_MAP[e.code](e.message)

        return SandboxException(f"{e.code}: {e.message}")
    else:
        return e


class ProtoJSONCodec:
    def name(self) -> str:
        return "json"

    def encode(self, message: Message) -> bytes:
        return MessageToJson(message).encode()

    def decode(self, data: bytes | bytearray, message: Message):
        Parse(data.decode(), message, ignore_unknown_fields=True)
        return message


def request_timeout_ms(timeout: Optional[float]) -> Optional[int]:
    if timeout is None:
        return None

    return int(timeout * 1000)


def stream_timeout_ms(
    timeout: Optional[float],
) -> Optional[int]:
    if timeout == 0:
        return None

    return request_timeout_ms(timeout)


def stream_request_headers(
    headers: dict[str, str],
    request_timeout: Optional[float],
) -> dict[str, str]:
    if request_timeout is None or request_timeout == 0:
        return headers

    return {
        **headers,
        STREAM_REQUEST_TIMEOUT_HEADER: str(request_timeout),
    }


class SandboxHeadersInterceptor:
    def __init__(self, headers: dict[str, str]) -> None:
        self._headers = headers

    def _add_headers(self, ctx: RequestContext) -> None:
        request_headers = ctx.request_headers()
        for key, value in self._headers.items():
            if key not in request_headers:
                request_headers[key] = value

    def on_start_sync(self, ctx: RequestContext) -> None:
        self._add_headers(ctx)

    async def on_start(self, ctx: RequestContext) -> None:
        self._add_headers(ctx)

    def on_end_sync(
        self, token: None, ctx: RequestContext, error: Exception | None
    ) -> None:
        return None

    async def on_end(
        self, token: None, ctx: RequestContext, error: Exception | None
    ) -> None:
        return None


def connect_client_kwargs(headers: dict[str, str], http_client):
    return {
        "codec": ProtoJSONCodec(),
        "accept_compression": (),
        "send_compression": None,
        "interceptors": (SandboxHeadersInterceptor(headers),),
        "http_client": http_client,
    }


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
