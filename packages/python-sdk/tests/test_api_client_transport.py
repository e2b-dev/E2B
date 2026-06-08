import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest

from e2b.api.client_async import AsyncEnvdTransportWithLogger, AsyncTransportWithLogger
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_envd_transport as get_async_envd_transport
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_sync import EnvdTransportWithLogger, TransportWithLogger
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.api.client_sync import get_envd_transport as get_sync_envd_transport
from e2b.api.client_sync import get_transport as get_sync_transport
from e2b.connection_config import ConnectionConfig


def reset_sync_api_transports():
    if hasattr(TransportWithLogger, "_thread_local"):
        TransportWithLogger._thread_local.instances = {}
    else:
        TransportWithLogger._instances.clear()


def reset_sync_envd_transports():
    EnvdTransportWithLogger._thread_local.instances = {}


def run_in_worker_thread(fn):
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(fn).result()


def test_sync_api_client_proxy_uses_explicit_transport(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is get_sync_transport(config)
        assert httpx_client._mounts == {}
    finally:
        httpx_client.close()
        reset_sync_api_transports()


def test_sync_get_transport_http2_opt_out_returns_distinct_instance(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key)

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
        reset_sync_api_transports()


def test_sync_envd_transport_uses_separate_cache(test_api_key):
    reset_sync_api_transports()
    reset_sync_envd_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        api_transport = get_sync_transport(config)
        envd_transport = get_sync_envd_transport(config)

        assert api_transport is not envd_transport
        assert get_sync_transport(config) is api_transport
        assert get_sync_envd_transport(config) is envd_transport
        assert envd_transport._pool._http2 is True
    finally:
        reset_sync_api_transports()
        reset_sync_envd_transports()


def test_sync_api_transport_cache_reuses_within_thread_and_isolates_across_threads(
    test_api_key,
):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        main_transport = get_sync_transport(config)
        same_thread_transport = get_sync_transport(config)
        worker_thread_transport = run_in_worker_thread(
            lambda: get_sync_transport(config)
        )

        assert same_thread_transport is main_transport
        assert worker_thread_transport is not main_transport
    finally:
        reset_sync_api_transports()


def test_sync_envd_transport_cache_is_thread_local(test_api_key):
    reset_sync_envd_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        main_transport = get_sync_envd_transport(config)
        thread_transport = run_in_worker_thread(lambda: get_sync_envd_transport(config))

        assert main_transport is get_sync_envd_transport(config)
        assert thread_transport is not main_transport
        assert main_transport._pool._http2 is True
        assert thread_transport._pool._http2 is True
    finally:
        reset_sync_envd_transports()


@pytest.mark.asyncio
async def test_async_api_client_proxy_uses_explicit_transport(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(
        api_key=test_api_key,
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
async def test_async_get_transport_http2_opt_out_returns_distinct_instance(
    test_api_key,
):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key)

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


@pytest.mark.asyncio
async def test_async_envd_transport_uses_separate_cache(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    AsyncEnvdTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        api_transport = get_async_transport(config)
        envd_transport = get_async_envd_transport(config)

        assert api_transport is not envd_transport
        assert get_async_transport(config) is api_transport
        assert get_async_envd_transport(config) is envd_transport
        assert envd_transport._pool._http2 is True
    finally:
        AsyncTransportWithLogger._instances.clear()
        AsyncEnvdTransportWithLogger._instances.clear()
