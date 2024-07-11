import json
import logging

from typing import Optional, Union
from httpx import HTTPTransport, AsyncHTTPTransport

from e2b.api.client.client import Client
from e2b.connection_config import ConnectionConfig
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException, SandboxException
from e2b.api.client.types import Response

logger = logging.getLogger(__name__)


def handle_api_exception(e: Response):
    body = json.loads(e.content) if e.content else {}
    if "message" in body:
        return SandboxException(f"{e.status_code}: {body['message']}")
    return SandboxException(f"{e.status_code}: {e.content}")


class ApiClient(Client):
    def __init__(
        self,
        config: ConnectionConfig,
        require_api_key: bool = True,
        require_access_token: bool = False,
        transport: Optional[Union[HTTPTransport, AsyncHTTPTransport]] = None,
        *args,
        **kwargs,
    ):
        if require_api_key and config.api_key is None:
            raise AuthenticationException(
                "API key is required, please visit https://e2b.dev/docs to get your API key. "
                "You can either set the environment variable `E2B_API_KEY` "
                'or you can pass it directly to the sandbox like Sandbox(api_key="e2b_...")',
            )

        if require_access_token and config.access_token is None:
            raise AuthenticationException(
                "Access token is required, please visit https://e2b.dev/docs to get your access token. "
                "You can set the environment variable `E2B_ACCESS_TOKEN` or pass the `access_token` in options.",
            )

        headers = {}
        if config.api_key:
            headers["X-API-KEY"] = config.api_key

        if config.access_token:
            headers["Authorization"] = f"Bearer {config.access_token}"

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
                **headers,
            },
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
