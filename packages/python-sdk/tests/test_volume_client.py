import asyncio
import threading

import httpx
import pytest

from e2b.exceptions import AuthenticationException
from e2b.volume.client_async import (
    get_api_client as get_async_api_client,
    get_transport as get_async_transport,
)
from e2b.volume.client_sync import (
    get_api_client as get_sync_api_client,
    get_transport as get_sync_transport,
)
from e2b.volume.connection_config import VolumeConnectionConfig


def test_sync_client_requires_volume_token(monkeypatch):
    monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

    with pytest.raises(AuthenticationException):
        get_sync_api_client(VolumeConnectionConfig())


def test_async_client_requires_volume_token(monkeypatch):
    monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

    with pytest.raises(AuthenticationException):
        get_async_api_client(VolumeConnectionConfig())


def test_sync_client_uses_config_request_timeout():
    client = get_sync_api_client(VolumeConnectionConfig(token="vol-token"))
    assert client.get_httpx_client().timeout == httpx.Timeout(60.0)

    client = get_sync_api_client(
        VolumeConnectionConfig(token="vol-token", request_timeout=10.0)
    )
    assert client.get_httpx_client().timeout == httpx.Timeout(10.0)

    client = get_sync_api_client(
        VolumeConnectionConfig(token="vol-token", request_timeout=0)
    )
    assert client.get_httpx_client().timeout == httpx.Timeout(None)


def test_async_client_uses_config_request_timeout():
    async def run():
        client = get_async_api_client(VolumeConnectionConfig(token="vol-token"))
        assert client.get_async_httpx_client().timeout == httpx.Timeout(60.0)

        client = get_async_api_client(
            VolumeConnectionConfig(token="vol-token", request_timeout=0)
        )
        assert client.get_async_httpx_client().timeout == httpx.Timeout(None)

    asyncio.run(run())


def test_sync_transport_is_cached_per_proxy():
    config = VolumeConnectionConfig(token="vol-token")
    proxied = VolumeConnectionConfig(token="vol-token", proxy="http://127.0.0.1:8080")

    transport_a = get_sync_transport(config)
    transport_b = get_sync_transport(config)
    transport_c = get_sync_transport(proxied)

    assert transport_a is transport_b
    assert transport_a is not transport_c


def test_sync_transport_is_not_shared_across_threads():
    config = VolumeConnectionConfig(token="vol-token")
    main_transport = get_sync_transport(config)

    result = {}

    def worker():
        result["transport"] = get_sync_transport(config)

    thread = threading.Thread(target=worker)
    thread.start()
    thread.join()

    assert result["transport"] is not main_transport


def test_async_transport_is_cached_per_event_loop():
    config = VolumeConnectionConfig(token="vol-token")
    proxied = VolumeConnectionConfig(token="vol-token", proxy="http://127.0.0.1:8080")

    async def get_transports():
        return get_async_transport(config), get_async_transport(config)

    async def get_proxied_transport():
        return get_async_transport(proxied)

    # Keep both loops alive at the same time so their ids cannot collide
    loop_a = asyncio.new_event_loop()
    loop_b = asyncio.new_event_loop()
    try:
        transport_a1, transport_a2 = loop_a.run_until_complete(get_transports())
        transport_b1, _ = loop_b.run_until_complete(get_transports())
        proxied_a = loop_a.run_until_complete(get_proxied_transport())

        # Same loop reuses the transport, another loop gets its own
        assert transport_a1 is transport_a2
        assert transport_a1 is not transport_b1

        # Different proxy gets its own transport even on the same loop
        assert proxied_a is not transport_a1
    finally:
        loop_a.close()
        loop_b.close()
