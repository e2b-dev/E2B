import json
import logging
import os
from dataclasses import dataclass
from types import TracebackType
from typing import Optional, Union

from httpx import AsyncBaseTransport, BaseTransport, Limits

from e2b.api.client.client import AuthenticatedClient
from e2b.api.client.types import Response
from e2b.api.metadata import default_headers
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import (
    AuthenticationException,
    RateLimitException,
    SandboxException,
)

logger = logging.getLogger(__name__)

limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS", "20")),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS", "2000")),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY", "300")),
)


@dataclass
class SandboxCreateResponse:
    sandbox_id: str
    sandbox_domain: Optional[str]
    envd_version: str
    envd_access_token: str
    traffic_access_token: Optional[str]


def handle_api_exception(
    e: Response,
    default_exception_class: type[Exception] = SandboxException,
    stack_trace: Optional[TracebackType] = None,
):
    try:
        body = json.loads(e.content) if e.content else {}
    except json.JSONDecodeError:
        body = {}

    if e.status_code == 401:
        message = f"{e.status_code}: Unauthorized, please check your credentials."
        if body.get("message"):
            message += f" - {body['message']}"
        return AuthenticationException(message)

    if e.status_code == 429:
        message = f"{e.status_code}: Rate limit exceeded, please try again later."
        if body.get("message"):
            message += f" - {body['message']}"
        return RateLimitException(message)

    if "message" in body:
        return default_exception_class(
            f"{e.status_code}: {body['message']}"
        ).with_traceback(stack_trace)
    return default_exception_class(f"{e.status_code}: {e.content}").with_traceback(
        stack_trace
    )


class ApiClient(AuthenticatedClient):
    """
    The client for interacting with the E2B API.
    """

    def __init__(
        self,
        config: ConnectionConfig,
        require_api_key: bool = True,
        require_access_token: bool = False,
        transport: Optional[Union[BaseTransport, AsyncBaseTransport]] = None,
        *args,
        **kwargs,
    ):
        if require_api_key and require_access_token:
            raise AuthenticationException(
                "Only one of api_key or access_token can be required, not both",
            )

        if not require_api_key and not require_access_token:
            raise AuthenticationException(
                "Either api_key or access_token is required",
            )

        token = None
        if require_api_key:
            if config.api_key is None:
                raise AuthenticationException(
                    "API key is required, please visit the Team tab at https://e2b.dev/dashboard to get your API key. "
                    "You can either set the environment variable `E2B_API_KEY` "
                    'or you can pass it directly to the method like api_key="e2b_..."',
                )
            token = config.api_key

        if require_access_token:
            if config.access_token is None:
                raise AuthenticationException(
                    "Access token is required, please visit the Personal tab at https://e2b.dev/dashboard to get your access token. "
                    "You can set the environment variable `E2B_ACCESS_TOKEN` or pass the `access_token` in options.",
                )
            token = config.access_token

        auth_header_name = "X-API-KEY" if require_api_key else "Authorization"
        prefix = "" if require_api_key else "Bearer"

        headers = {
            **default_headers,
            **(config.headers or {}),
        }

        # Prevent passing these parameters twice
        more_headers: Optional[dict] = kwargs.pop("headers", None)
        if more_headers:
            headers.update(more_headers)
        kwargs.pop("token", None)
        kwargs.pop("auth_header_name", None)
        kwargs.pop("prefix", None)

        super().__init__(
            base_url=config.api_url,
            httpx_args={
                "event_hooks": {
                    "request": [self._log_request],
                    "response": [self._log_response],
                },
                "proxy": config.proxy,
                "transport": transport,
            },
            headers=headers,
            token=token,
            auth_header_name=auth_header_name,
            prefix=prefix,
            *args,
            **kwargs,
        )

    def _log_request(self, request):
        logger.info(f"Request {request.method} {request.url}")

    def _log_response(self, response: Response):
        if response.status_code >= 400:
            logger.error(f"Response {response.status_code}")
        else:
            logger.info(f"Response {response.status_code}")


# We need to override the logging hooks for the async usage
class AsyncApiClient(ApiClient):
    async def _log_request(self, request):
        logger.info(f"Request {request.method} {request.url}")

    async def _log_response(self, response: Response):
        if response.status_code >= 400:
            logger.error(f"Response {response.status_code}")
        else:
            logger.info(f"Response {response.status_code}")
