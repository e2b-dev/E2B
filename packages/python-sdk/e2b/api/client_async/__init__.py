import asyncio
import logging
from typing import Dict, Tuple

import httpx

from e2b.api import AsyncApiClient, limits
from e2b.connection_config import ConnectionConfig
from e2b._retry import retry_request_async

logger = logging.getLogger(__name__)


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    _instances: Dict[Tuple[int, bool, int], "AsyncTransportWithLogger"] = {}

    def __init__(self, *args, retries: int = 0, **kwargs):
        self._retries = retries
        super().__init__(*args, **kwargs)

    async def handle_async_request(self, request):
        return await retry_request_async(request, self._send, self._retries)

    async def _send(self, request):
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
    loop_id = (id(asyncio.get_running_loop()), http2, config.retries)

    if loop_id in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[loop_id]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=config.retries,
    )

    AsyncTransportWithLogger._instances[loop_id] = transport
    return transport


class AsyncEnvdTransportWithLogger(AsyncTransportWithLogger):
    _instances: Dict[Tuple[int, bool, int], "AsyncEnvdTransportWithLogger"] = {}


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncEnvdTransportWithLogger:
    loop_id = (id(asyncio.get_running_loop()), http2, config.retries)

    if loop_id in AsyncEnvdTransportWithLogger._instances:
        return AsyncEnvdTransportWithLogger._instances[loop_id]

    transport = AsyncEnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=config.retries,
    )

    AsyncEnvdTransportWithLogger._instances[loop_id] = transport
    return transport
