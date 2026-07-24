from typing import Dict, Optional, Tuple

import threading

from httpx._types import ProxyTypes

from e2b.api import (
    _TCPKeepaliveHTTPTransport,
    ApiClient,
    connection_retries,
    limits,
)
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport_factory=lambda: get_transport(config),
        **kwargs,
    )


class TransportWithLogger(_TCPKeepaliveHTTPTransport):
    _thread_local = threading.local()

    @property
    def pool(self):
        return self._pool


def _create_transport(cls, config: ConnectionConfig, http2: bool):
    """Build a keepalive transport of the given class for this config."""
    return cls(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=connection_retries,
    )


def get_transport(config: ConnectionConfig, http2: bool = True) -> TransportWithLogger:
    instances: Dict[TransportKey, TransportWithLogger] = getattr(
        TransportWithLogger._thread_local, "instances", {}
    )
    key: TransportKey = (http2, config.proxy)
    cached = instances.get(key)
    if cached is not None:
        return cached

    transport = _create_transport(TransportWithLogger, config, http2)
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

    transport = _create_transport(EnvdTransportWithLogger, config, http2)
    instances[key] = transport
    EnvdTransportWithLogger._thread_local.instances = instances
    return transport
