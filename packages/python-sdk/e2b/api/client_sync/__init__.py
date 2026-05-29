from typing import Dict

import httpx
import logging

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
    _instances: Dict[bool, "TransportWithLogger"] = {}

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


def get_transport(config: ConnectionConfig, http2: bool = True) -> TransportWithLogger:
    cached = TransportWithLogger._instances.get(http2)
    if cached is not None:
        return cached

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )
    TransportWithLogger._instances[http2] = transport
    return transport


class EnvdTransportWithLogger(TransportWithLogger):
    _instances: Dict[bool, "EnvdTransportWithLogger"] = {}


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> EnvdTransportWithLogger:
    cached = EnvdTransportWithLogger._instances.get(http2)
    if cached is not None:
        return cached

    transport = EnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )
    EnvdTransportWithLogger._instances[http2] = transport
    return transport
