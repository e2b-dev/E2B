import asyncio

import pytest

from e2b.api.client_async import AsyncTransportWithLogger
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_sync import TransportWithLogger
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.api.client_sync import get_transport as get_sync_transport
from e2b.connection_config import ConnectionConfig


def test_sync_api_client_proxy_uses_explicit_transport():
    TransportWithLogger._instances.clear()
    config = ConnectionConfig(
        api_key="e2b_test",
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is TransportWithLogger._instances[True]
        assert httpx_client._mounts == {}
    finally:
        httpx_client.close()
        TransportWithLogger._instances.clear()


def test_sync_get_transport_http2_opt_out_returns_distinct_instance():
    TransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key="e2b_test")

    try:
        http2_transport = get_sync_transport(config)
        http1_transport = get_sync_transport(config, http2=False)

        assert http2_transport is not http1_transport
        assert http2_transport._pool._http2 is True
        assert http1_transport._pool._http2 is False
        # Subsequent calls with the same http2 flag return the cached
        # instance.
        assert get_sync_transport(config) is http2_transport
        assert get_sync_transport(config, http2=False) is http1_transport
    finally:
        TransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_async_api_client_proxy_uses_explicit_transport():
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(
        api_key="e2b_test",
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()
    transport = AsyncTransportWithLogger._instances[
        (id(asyncio.get_running_loop()), True)
    ]

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is transport
        assert httpx_client._mounts == {}
    finally:
        await httpx_client.aclose()
        AsyncTransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_async_get_transport_http2_opt_out_returns_distinct_instance():
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key="e2b_test")

    try:
        http2_transport = get_async_transport(config)
        http1_transport = get_async_transport(config, http2=False)

        assert http2_transport is not http1_transport
        assert http2_transport._pool._http2 is True
        assert http1_transport._pool._http2 is False
        # Subsequent calls with the same http2 flag return the cached
        # instance.
        assert get_async_transport(config) is http2_transport
        assert get_async_transport(config, http2=False) is http1_transport
    finally:
        AsyncTransportWithLogger._instances.clear()
