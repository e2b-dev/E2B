import asyncio
import httpx
import logging

from typing import Dict, Tuple

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
    _instances: Dict[Tuple[int, bool], "AsyncTransportWithLogger"] = {}

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
    key = (id(asyncio.get_running_loop()), http2)

    if key in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[key]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )
    AsyncTransportWithLogger._instances[key] = transport
    return transport
