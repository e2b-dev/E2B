from typing import Dict

import httpx
import logging
import threading

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
    _thread_local = threading.local()


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> EnvdTransportWithLogger:
    instances: Dict[bool, EnvdTransportWithLogger] = getattr(
        EnvdTransportWithLogger._thread_local, "instances", {}
    )
    cached = instances.get(http2)
    if cached is not None:
        return cached

    transport = EnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )
    instances[http2] = transport
    EnvdTransportWithLogger._thread_local.instances = instances
    return transport
