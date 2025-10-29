import httpx
import logging

from typing import TypeVar, Union, Callable, Awaitable, Optional

from e2b.connection_config import ConnectionConfig
from e2b.api import limits, AsyncApiClient

T = TypeVar("T")
OutputHandler = Union[
    Callable[[T], None],
    Callable[[T], Awaitable[None]],
]

logger = logging.getLogger(__name__)


def get_api_client(config: ConnectionConfig) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        transport=get_transport(),
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
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


_transport: Optional[AsyncTransportWithLogger] = None


def get_transport() -> AsyncTransportWithLogger:
    global _transport
    if _transport is None:
        _transport = AsyncTransportWithLogger(limits=limits)
    return _transport
