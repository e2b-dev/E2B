import asyncio
import httpx
import logging

from typing import Dict

from e2b.connection_config import ConnectionConfig
from e2b.api import limits, AsyncApiClient


logger = logging.getLogger(__name__)


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    _instances: Dict[int, "AsyncTransportWithLogger"] = {}

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


def get_transport(config: ConnectionConfig) -> AsyncTransportWithLogger:
    loop_id = id(asyncio.get_running_loop())

    if loop_id in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[loop_id]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
    )
    AsyncTransportWithLogger._instances[loop_id] = transport
    return transport
