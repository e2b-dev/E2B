import json
import logging

from typing import Optional, Union
from httpx import HTTPTransport, AsyncHTTPTransport

from e2b.api.client.client import AuthenticatedClient
from e2b.connection_config import ConnectionConfig
from e2b.api.metadata import default_headers
from e2b.exceptions import (
    AuthenticationException,
    SandboxException,
    RateLimitException,
)
from e2b.api.client.types import Response

logger = logging.getLogger(__name__)


def handle_api_exception(e: Response):
    try:
        body = json.loads(e.content) if e.content else {}
    except json.JSONDecodeError:
        body = {}

    if e.status_code == 429:
        return RateLimitException(
            f"{e.status_code}: Rate limit exceeded, please try again later."
        )

    if "message" in body:
        return SandboxException(f"{e.status_code}: {body['message']}")
    return SandboxException(f"{e.status_code}: {e.content}")


class ApiClient(AuthenticatedClient):
    """
    The client for interacting with the E2B API.
    """

    def __init__(
        self,
        config: ConnectionConfig,
        require_api_key: bool = True,
        require_access_token: bool = False,
        transport: Optional[Union[HTTPTransport, AsyncHTTPTransport]] = None,
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
                    "API key is required, please visit https://e2b.dev/docs to get your API key. "
                    "You can either set the environment variable `E2B_API_KEY` "
                    'or you can pass it directly to the sandbox like Sandbox(api_key="e2b_...")',
                )
            token = config.api_key

        if require_access_token:
            if config.access_token is None:
                raise AuthenticationException(
                    "Access token is required, please visit https://e2b.dev/docs to get your access token. "
                    "You can set the environment variable `E2B_ACCESS_TOKEN` or pass the `access_token` in options.",
                )
            token = config.access_token

        auth_header_name = "X-API-KEY" if require_api_key else "Authorization"
        prefix = "" if require_api_key else "Bearer"

        super().__init__(
            base_url=config.api_url,
            httpx_args={
                "event_hooks": {
                    "request": [self._log_request],
                    "response": [self._log_response],
                },
                "transport": transport,
            },
            headers={
                **default_headers,
            },
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
