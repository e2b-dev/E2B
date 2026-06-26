import os
import threading
from typing import Dict, Optional

import httpx
from httpx import Limits
from httpx._types import ProxyTypes

from e2b.api import make_logging_event_hooks
from e2b.api.metadata import default_headers
from e2b.exceptions import AuthenticationException
from e2b.volume.client.client import AuthenticatedClient as VolumeApiClient
from e2b.volume.connection_config import VolumeConnectionConfig

limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS", "20")),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS", "2000")),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY", "300")),
)

TransportKey = Optional[ProxyTypes]


def get_api_client(config: VolumeConnectionConfig, **kwargs) -> VolumeApiClient:
    if config.access_token is None:
        raise AuthenticationException(
            "Volume token is required for volume content operations. "
            "Use `Volume.create`/`Volume.connect` to obtain it "
            "or pass `token` in options.",
        )

    headers = {
        **default_headers,
        **(config.headers or {}),
    }

    request_timeout = config.request_timeout

    return VolumeApiClient(
        base_url=config.api_url,
        token=config.access_token,
        auth_header_name="Authorization",
        prefix="Bearer",
        headers=headers,
        timeout=(
            httpx.Timeout(request_timeout) if request_timeout is not None else None
        ),
        httpx_args={
            "proxy": config.proxy,
            "transport": get_transport(config),
            "event_hooks": make_logging_event_hooks(config.logger),
        },
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    _thread_local = threading.local()

    @property
    def pool(self):
        return self._pool


def get_transport(config: VolumeConnectionConfig) -> TransportWithLogger:
    instances: Dict[TransportKey, TransportWithLogger] = getattr(
        TransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = config.proxy
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
    )
    instances[key] = transport
    TransportWithLogger._thread_local.instances = instances
    return transport
