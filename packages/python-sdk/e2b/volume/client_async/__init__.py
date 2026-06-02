import logging
import os
from typing import Optional

import httpx
from httpx import Limits

from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as AsyncVolumeApiClient
from e2b.volume.connection_config import VolumeConnectionConfig

logger = logging.getLogger(__name__)

limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS", "20")),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS", "2000")),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY", "300")),
)


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> AsyncVolumeApiClient:
    if config.access_token is None:
        raise AuthenticationException(
            "Access token is required for volume operations. "
            "Set `E2B_ACCESS_TOKEN` or pass `token` in options.",
        )

    headers = {
        **default_headers,
        **(config.headers or {}),
    }

    return AsyncVolumeApiClient(
        base_url=config.api_url,
        token=config.access_token,
        auth_header_name="Authorization",
        prefix="Bearer",
        headers=headers,
        httpx_args={"proxy": config.proxy, "transport": get_transport(config)},
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    singleton: Optional["AsyncTransportWithLogger"] = None

    async def handle_async_request(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = await super().handle_async_request(request)
        logger.info(f"Response: {response.status_code} {url}")
        return response

    @property
    def pool(self):
        return self._pool


def get_transport(config: VolumeConnectionConfig) -> AsyncTransportWithLogger:
    if AsyncTransportWithLogger.singleton is not None:
        return AsyncTransportWithLogger.singleton

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
    )
    AsyncTransportWithLogger.singleton = transport
    return transport
