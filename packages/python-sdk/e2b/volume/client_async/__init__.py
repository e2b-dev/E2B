import asyncio
import logging
import os
from typing import Dict, Optional, Tuple

import httpx
from httpx import Limits
from httpx._types import ProxyTypes

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

TransportKey = Tuple[int, Optional[ProxyTypes]]


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> AsyncVolumeApiClient:
    if config.access_token is None:
        raise AuthenticationException(
            "Volume token is required for volume content operations. "
            "Use `AsyncVolume.create`/`AsyncVolume.connect` to obtain it "
            "or pass `token` in options.",
        )

    headers = {
        **default_headers,
        **(config.headers or {}),
    }

    request_timeout = config.request_timeout

    return AsyncVolumeApiClient(
        base_url=config.api_url,
        token=config.access_token,
        auth_header_name="Authorization",
        prefix="Bearer",
        headers=headers,
        timeout=(
            httpx.Timeout(request_timeout) if request_timeout is not None else None
        ),
        httpx_args={"proxy": config.proxy, "transport": get_transport(config)},
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    _instances: Dict[TransportKey, "AsyncTransportWithLogger"] = {}

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
    key: TransportKey = (id(asyncio.get_running_loop()), config.proxy)

    if key in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[key]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
    )
    AsyncTransportWithLogger._instances[key] = transport
    return transport
