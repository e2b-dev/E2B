import asyncio
from typing import Dict, Tuple

import httpx

from e2b.api import AsyncApiClient, limits
from e2b.connection_config import ConnectionConfig


def get_api_client(config: ConnectionConfig, **kwargs) -> AsyncApiClient:
    return AsyncApiClient(
        config,
        transport=get_transport(config),
        **kwargs,
    )


class AsyncTransportWithLogger(httpx.AsyncHTTPTransport):
    _instances: Dict[Tuple[int, bool], "AsyncTransportWithLogger"] = {}

    @property
    def pool(self):
        return self._pool


def get_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncTransportWithLogger:
    loop_id = (id(asyncio.get_running_loop()), http2)

    if loop_id in AsyncTransportWithLogger._instances:
        return AsyncTransportWithLogger._instances[loop_id]

    transport = AsyncTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )

    AsyncTransportWithLogger._instances[loop_id] = transport
    return transport


class AsyncEnvdTransportWithLogger(AsyncTransportWithLogger):
    _instances: Dict[Tuple[int, bool], "AsyncEnvdTransportWithLogger"] = {}


def get_envd_transport(
    config: ConnectionConfig, http2: bool = True
) -> AsyncEnvdTransportWithLogger:
    loop_id = (id(asyncio.get_running_loop()), http2)

    if loop_id in AsyncEnvdTransportWithLogger._instances:
        return AsyncEnvdTransportWithLogger._instances[loop_id]

    transport = AsyncEnvdTransportWithLogger(
        limits=limits,
        proxy=config.proxy,
        http2=http2,
    )

    AsyncEnvdTransportWithLogger._instances[loop_id] = transport
    return transport
