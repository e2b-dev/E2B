import logging
import os
from typing import Optional

import httpx
from httpx import Limits

from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as VolumeApiClient
from e2b.volume.connection_config import VolumeConnectionConfig
from e2b._retry import retry_request_sync

logger = logging.getLogger(__name__)

limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS", "20")),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS", "2000")),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY", "300")),
)


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> VolumeApiClient:
    if config.access_token is None:
        raise AuthenticationException(
            "Access token is required for volume operations. "
            "Set `E2B_ACCESS_TOKEN` or pass `token` in options.",
        )

    headers = {
        **default_headers,
        **(config.headers or {}),
    }

    return VolumeApiClient(
        base_url=config.api_url,
        token=config.access_token,
        auth_header_name="Authorization",
        prefix="Bearer",
        headers=headers,
        httpx_args={"proxy": config.proxy, "transport": get_transport(config)},
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    singleton: Optional["TransportWithLogger"] = None

    def __init__(self, *args, retries: int = 0, **kwargs):
        self._retries = retries
        super().__init__(*args, **kwargs)

    def handle_request(self, request):
        return retry_request_sync(request, self._send, self._retries)

    def _send(self, request):
        url = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        logger.info(f"Request: {request.method} {url}")
        response = super().handle_request(request)
        logger.info(f"Response: {response.status_code} {url}")
        return response

    @property
    def pool(self):
        return self._pool


def get_transport(config: VolumeConnectionConfig) -> TransportWithLogger:
    if (
        TransportWithLogger.singleton is not None
        and TransportWithLogger.singleton._retries == config.retries
    ):
        return TransportWithLogger.singleton

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        retries=config.retries,
    )
    TransportWithLogger.singleton = transport
    return transport
