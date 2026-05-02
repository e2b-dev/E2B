import asyncio

import pytest

from e2b.api.client_async import AsyncTransportWithLogger
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_sync import TransportWithLogger
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.connection_config import ConnectionConfig


def test_sync_api_client_proxy_uses_explicit_transport():
    TransportWithLogger.singleton = None
    config = ConnectionConfig(
        api_key="test",
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is TransportWithLogger.singleton
        assert httpx_client._mounts == {}
    finally:
        httpx_client.close()
        TransportWithLogger.singleton = None


@pytest.mark.asyncio
async def test_async_api_client_proxy_uses_explicit_transport():
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(
        api_key="test",
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()
    transport = AsyncTransportWithLogger._instances[id(asyncio.get_running_loop())]

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is transport
        assert httpx_client._mounts == {}
    finally:
        await httpx_client.aclose()
        AsyncTransportWithLogger._instances.clear()
