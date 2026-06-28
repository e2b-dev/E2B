from typing import Dict, Optional, Tuple


import httpx
import httpcore
import time

import threading

from httpx._types import ProxyTypes

from e2b.api import ApiClient, connection_retries, limits
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> ApiClient:
    return ApiClient(
        config,
        transport_factory=lambda: get_transport(config),
        **kwargs,
    )


class TransportWithLogger(httpx.HTTPTransport):
    _thread_local = threading.local()

    @property
    def pool(self):
        return self._pool

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        connection_retries = 3
        for attempt in range(connection_retries + 1):
            try:
                return super().handle_request(request)
            except (httpcore.RemoteProtocolError, httpcore.LocalProtocolError):
                if attempt == connection_retries:
                    raise
                time.sleep(0.1)



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
        retries=connection_retries,
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
        retries=connection_retries,
    )
    instances[key] = transport
    EnvdTransportWithLogger._thread_local.instances = instances
    return transport
