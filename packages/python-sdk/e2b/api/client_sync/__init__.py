from typing import Dict, Optional, Tuple

import httpx
import threading

from httpx._types import ProxyTypes

from e2b.api import ApiClient, limits
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    _thread_local = threading.local()

    @property
    def pool(self):
        return self._pool


def get_transport(config: ConnectionConfig, http2: bool = True) -> TransportWithLogger:
    instances: Dict[TransportKey, TransportWithLogger] = getattr(
        TransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = (http2, config.proxy)
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = TransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )
    instances[key] = transport
    TransportWithLogger._thread_local.instances = instances
    return transport


class EnvdTransportWithLogger(TransportWithLogger):
    _thread_local = threading.local()


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> EnvdTransportWithLogger:
    instances: Dict[TransportKey, EnvdTransportWithLogger] = getattr(
        EnvdTransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = (http2, config.proxy)
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = EnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )
    instances[key] = transport
    EnvdTransportWithLogger._thread_local.instances = instances
    return transport
