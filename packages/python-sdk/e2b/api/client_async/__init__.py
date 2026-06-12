import asyncio
from typing import Dict, Optional, Tuple

import httpx

from httpx._types import ProxyTypes

from e2b.api import AsyncApiClient, connection_retries, limits
from e2b.connection_config import ConnectionConfig

TransportKey = Tuple[int, bool, Optional[ProxyTypes]]


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        async_transport_factory=lambda: get_transport(config),
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    _instances: Dict[TransportKey, "AsyncTransportWithLogger"] = {}

    @property
    def pool(self):
        return self._pool


def get_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncTransportWithLogger:
    key: TransportKey = (id(asyncio.get_running_loop()), http2, config.proxy)

    if key in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[key]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=connection_retries,
    )

    AsyncTransportWithLogger._instances[key] = transport
    return transport


class AsyncEnvdTransportWithLogger(AsyncTransportWithLogger):
    _instances: Dict[TransportKey, "AsyncEnvdTransportWithLogger"] = {}


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncEnvdTransportWithLogger:
    key: TransportKey = (id(asyncio.get_running_loop()), http2, config.proxy)

    if key in AsyncEnvdTransportWithLogger._instances:
        return AsyncEnvdTransportWithLogger._instances[key]

    transport = AsyncEnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
        retries=connection_retries,
    )

    AsyncEnvdTransportWithLogger._instances[key] = transport
    return transport
