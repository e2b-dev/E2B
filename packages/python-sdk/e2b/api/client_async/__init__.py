import asyncio
import logging
from typing import Dict, Optional, Tuple

import httpx

from httpx._types import ProxyTypes

from e2b.api import AsyncApiClient, limits
from e2b.connection_config import ConnectionConfig

logger = logging.getLogger(__name__)

TransportKey = Tuple[int, bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    _instances: Dict[TransportKey, "AsyncTransportWithLogger"] = {}

    async def handle_async_request(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = await super().handle_async_request(request)

        # data = connect.GzipCompressor.decompress(response.read()).decode()
        logger.info(f"Response: {response.status_code} {url}")

        return response

    @property
    def pool(self):
        return self._pool


def get_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncTransportWithLogger:
    key: TransportKey = (id(asyncio.get_running_loop()), http2, config.proxy)

    if key in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[key]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )

    AsyncTransportWithLogger._instances[key] = transport
    return transport


class AsyncEnvdTransportWithLogger(AsyncTransportWithLogger):
    _instances: Dict[TransportKey, "AsyncEnvdTransportWithLogger"] = {}


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncEnvdTransportWithLogger:
    key: TransportKey = (id(asyncio.get_running_loop()), http2, config.proxy)

    if key in AsyncEnvdTransportWithLogger._instances:
        return AsyncEnvdTransportWithLogger._instances[key]

    transport = AsyncEnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )

    AsyncEnvdTransportWithLogger._instances[key] = transport
    return transport
