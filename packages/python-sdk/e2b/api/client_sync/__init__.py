from typing import Dict, Tuple

import httpx
import logging
import threading

from e2b.api import ApiClient, limits
from e2b.connection_config import ConnectionConfig
from e2b._retry import retry_request_sync

logger = logging.getLogger(__name__)


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    _instances: Dict[Tuple[bool, int], "TransportWithLogger"] = {}

    def __init__(self, *args, retries: int = 0, **kwargs):
        self._retries = retries
        super().__init__(*args, **kwargs)

    def handle_request(self, request):
        return retry_request_sync(request, self._send, self._retries)

    def _send(self, request):
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
    key = (http2, config.retries)
    cached = TransportWithLogger._instances.get(key)
    if cached is not None:
        return cached

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=config.retries,
    )
    TransportWithLogger._instances[key] = transport
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
