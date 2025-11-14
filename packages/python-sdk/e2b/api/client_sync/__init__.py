from typing import Optional

import httpx
import logging

from typing_extensions import Self

from e2b.api import ApiClient, limits
from e2b.connection_config import ConnectionConfig

logger = logging.getLogger(__name__)


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    singleton: Optional[Self] = None

    def handle_request(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = super().handle_request(request)

        # data = connect.GzipCompressor.decompress(response.read()).decode()
        logger.info(f"Response: {response.status_code} {url}")

        return response

    @property
    def pool(self):
        return self._pool


_transport: Optional[TransportWithLogger] = None


def get_transport(config: ConnectionConfig) -> TransportWithLogger:
    if TransportWithLogger.singleton is not None:
        return TransportWithLogger.singleton

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
    )
    TransportWithLogger.singleton = transport
    return transport
