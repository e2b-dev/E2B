import asyncio
import gc
import socket
import ssl
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from e2b.api import (
    _TCP_KEEPALIVE_SOCKET_OPTIONS,
    _TCPKeepaliveAsyncNetworkBackend,
    _TCPKeepaliveNetworkBackend,
    _TCPKeepaliveTransport,
    ApiClient,
    _get_socket_options,
)
from e2b.api.client_async import AsyncEnvdTransportWithLogger, AsyncTransportWithLogger
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_envd_transport as get_async_envd_transport
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_sync import EnvdTransportWithLogger, TransportWithLogger
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.api.client_sync import get_envd_transport as get_sync_envd_transport
from e2b.api.client_sync import get_transport as get_sync_transport
from e2b.connection_config import ConnectionConfig


def test_socket_options_use_tcp_keepidle_when_available():
    assert _get_socket_options("linux", tcp_keepidle=4, tcp_keepalive=None) == (
        (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
        (socket.IPPROTO_TCP, 4, 60),
    )


def test_socket_options_use_macos_tcp_keepalive_fallback():
    assert _get_socket_options("darwin", tcp_keepidle=None, tcp_keepalive=16) == (
        (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
        (socket.IPPROTO_TCP, 16, 60),
    )


def test_socket_options_fall_back_to_enabling_keepalive_only():
    assert _get_socket_options("win32", tcp_keepidle=None, tcp_keepalive=16) == (
        (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
    )


def test_socket_options_windows_ignores_tcp_keepidle():
    # Windows CPython defines TCP_KEEPIDLE, but setting it raises OSError on
    # Windows releases older than 10 1709, so Windows stays enable-only with
    # OS-default probe timing.
    assert _get_socket_options("win32", tcp_keepidle=4, tcp_keepalive=None) == (
        (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
    )


def test_sync_network_backend_forces_keepalive_options():
    backend = Mock()
    wrapped = _TCPKeepaliveNetworkBackend(backend)

    wrapped.connect_tcp("example.com", 443, socket_options=None)

    backend.connect_tcp.assert_called_once_with(
        "example.com",
        443,
        timeout=None,
        local_address=None,
        socket_options=_TCP_KEEPALIVE_SOCKET_OPTIONS,
    )


@pytest.mark.asyncio
async def test_async_network_backend_forces_keepalive_options():
    backend = Mock()
    backend.connect_tcp = AsyncMock()
    wrapped = _TCPKeepaliveAsyncNetworkBackend(backend)

    await wrapped.connect_tcp("example.com", 443, socket_options=None)

    backend.connect_tcp.assert_awaited_once_with(
        "example.com",
        443,
        timeout=None,
        local_address=None,
        socket_options=_TCP_KEEPALIVE_SOCKET_OPTIONS,
    )


def reset_sync_api_transports():
    TransportWithLogger._thread_local.instances = {}


def reset_sync_envd_transports():
    EnvdTransportWithLogger._thread_local.instances = {}


def run_in_worker_thread(fn):
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(fn).result()


def get_transport_option(transport, name):
    return getattr(getattr(transport, "_pool"), name)


def set_only_https_proxy(monkeypatch, proxy):
    for name in (
        "ALL_PROXY",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "NO_PROXY",
        "all_proxy",
        "http_proxy",
        "https_proxy",
        "no_proxy",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("HTTPS_PROXY", proxy)


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
        assert (
            get_transport_option(httpx_client._transport, "_socket_options")
            == _TCP_KEEPALIVE_SOCKET_OPTIONS
        )
        assert isinstance(
            get_transport_option(httpx_client._transport, "_network_backend"),
            _TCPKeepaliveNetworkBackend,
        )
    finally:
        httpx_client.close()
        reset_sync_api_transports()


def test_direct_api_client_uses_owned_sync_keepalive_transport(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )
    api_client = ApiClient(config, verify_ssl=False)
    httpx_client = api_client.get_httpx_client()

    try:
        assert isinstance(httpx_client._transport, _TCPKeepaliveTransport)
        transport = httpx_client._transport._sync_transport
        assert get_transport_option(transport, "_http2") is False
        assert (
            get_transport_option(transport, "_socket_options")
            == _TCP_KEEPALIVE_SOCKET_OPTIONS
        )
        assert (
            get_transport_option(transport, "_ssl_context").verify_mode == ssl.CERT_NONE
        )
    finally:
        httpx_client.close()
        reset_sync_api_transports()


def test_direct_api_client_preserves_explicit_sync_transport(test_api_key):
    transport = httpx.MockTransport(lambda request: httpx.Response(200))
    api_client = ApiClient(ConnectionConfig(api_key=test_api_key), transport=transport)

    try:
        assert api_client.get_httpx_client()._transport is transport
    finally:
        api_client.get_httpx_client().close()


def test_direct_api_client_preserves_set_httpx_client(test_api_key):
    user_client = httpx.Client(transport=httpx.MockTransport(lambda request: None))
    api_client = ApiClient(ConnectionConfig(api_key=test_api_key))
    api_client.set_httpx_client(user_client)

    try:
        assert api_client.get_httpx_client() is user_client
    finally:
        user_client.close()


def test_direct_api_client_preserves_environment_proxy(test_api_key, monkeypatch):
    set_only_https_proxy(monkeypatch, "http://127.0.0.1:9999")
    api_client = ApiClient(ConnectionConfig(api_key=test_api_key), verify_ssl=False)
    httpx_client = api_client.get_httpx_client()

    try:
        transport = httpx_client._transport_for_url(httpx.URL("https://example.com"))
        assert isinstance(transport, _TCPKeepaliveTransport)
        assert transport is not httpx_client._transport
        assert (
            get_transport_option(transport._sync_transport, "_proxy_url").origin.host
            == b"127.0.0.1"
        )
    finally:
        httpx_client.close()


def test_sync_get_transport_http2_opt_out_returns_distinct_instance(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        http2_transport = get_sync_transport(config)
        http1_transport = get_sync_transport(config, http2=False)

        assert http2_transport is not http1_transport
        assert get_transport_option(http2_transport, "_http2") is True
        assert get_transport_option(http1_transport, "_http2") is False
        # Subsequent calls with the same http2 flag return the cached
        # instance.
        assert get_sync_transport(config) is http2_transport
        assert get_sync_transport(config, http2=False) is http1_transport
    finally:
        reset_sync_api_transports()


def test_sync_get_transport_keyed_by_proxy(test_api_key):
    reset_sync_api_transports()
    proxied_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )
    direct_config = ConnectionConfig(api_key=test_api_key)
    other_proxy_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:8888",
    )

    try:
        proxied_transport = get_sync_transport(proxied_config)
        direct_transport = get_sync_transport(direct_config)
        other_proxy_transport = get_sync_transport(other_proxy_config)

        assert proxied_transport is not direct_transport
        assert proxied_transport is not other_proxy_transport
        assert direct_transport is not other_proxy_transport
        # The same proxy still reuses the cached instance.
        assert get_sync_transport(proxied_config) is proxied_transport
        assert get_sync_transport(direct_config) is direct_transport
    finally:
        reset_sync_api_transports()


def test_sync_api_client_applies_request_timeout(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=1.5)

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(1.5)
    finally:
        httpx_client.close()
        reset_sync_api_transports()


def test_sync_api_client_request_timeout_zero_disables_timeout(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=0)

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(None)
    finally:
        httpx_client.close()
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
        assert get_transport_option(envd_transport, "_http2") is True
        assert (
            get_transport_option(envd_transport, "_socket_options")
            == _TCP_KEEPALIVE_SOCKET_OPTIONS
        )
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


def test_sync_api_client_cache_reuses_within_thread_and_isolates_across_threads(
    test_api_key,
):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key)
    api_client = get_sync_api_client(config)

    def get_worker_client_ids():
        httpx_client = api_client.get_httpx_client()
        try:
            return (
                id(httpx_client),
                id(api_client.get_httpx_client()),
                id(httpx_client._transport),
                id(get_sync_transport(config)),
            )
        finally:
            httpx_client.close()

    try:
        main_client = api_client.get_httpx_client()
        (
            worker_client_id,
            worker_cached_client_id,
            worker_transport_id,
            worker_cached_transport_id,
        ) = run_in_worker_thread(get_worker_client_ids)

        assert api_client.get_httpx_client() is main_client
        assert worker_client_id == worker_cached_client_id
        assert worker_transport_id == worker_cached_transport_id
        assert worker_client_id != id(main_client)
        assert worker_transport_id != id(main_client._transport)
    finally:
        main_client.close()
        reset_sync_api_transports()


def test_sync_envd_transport_cache_is_thread_local(test_api_key):
    reset_sync_envd_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        main_transport = get_sync_envd_transport(config)
        thread_transport = run_in_worker_thread(lambda: get_sync_envd_transport(config))

        assert main_transport is get_sync_envd_transport(config)
        assert thread_transport is not main_transport
        assert get_transport_option(main_transport, "_http2") is True
        assert get_transport_option(thread_transport, "_http2") is True
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
    transport = AsyncTransportWithLogger._instances[asyncio.get_running_loop()][
        (True, "http://127.0.0.1:9999")
    ]

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is transport
        assert httpx_client._mounts == {}
        assert (
            get_transport_option(httpx_client._transport, "_socket_options")
            == _TCP_KEEPALIVE_SOCKET_OPTIONS
        )
        assert isinstance(
            get_transport_option(httpx_client._transport, "_network_backend"),
            _TCPKeepaliveAsyncNetworkBackend,
        )
    finally:
        await httpx_client.aclose()
        AsyncTransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_direct_api_client_uses_owned_async_keepalive_transport(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )
    api_client = ApiClient(config, verify_ssl=False)
    httpx_client = api_client.get_async_httpx_client()

    try:
        assert isinstance(httpx_client._transport, _TCPKeepaliveTransport)
        transport = httpx_client._transport._async_transport
        assert get_transport_option(transport, "_http2") is False
        assert (
            get_transport_option(transport, "_socket_options")
            == _TCP_KEEPALIVE_SOCKET_OPTIONS
        )
        assert (
            get_transport_option(transport, "_ssl_context").verify_mode == ssl.CERT_NONE
        )
    finally:
        await httpx_client.aclose()
        AsyncTransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_direct_api_client_preserves_explicit_async_transport(test_api_key):
    transport = httpx.MockTransport(lambda request: httpx.Response(200))
    api_client = ApiClient(ConnectionConfig(api_key=test_api_key), transport=transport)

    try:
        assert api_client.get_async_httpx_client()._transport is transport
    finally:
        await api_client.get_async_httpx_client().aclose()


@pytest.mark.asyncio
async def test_direct_api_client_preserves_set_async_httpx_client(test_api_key):
    user_client = httpx.AsyncClient(transport=httpx.MockTransport(lambda request: None))
    api_client = ApiClient(ConnectionConfig(api_key=test_api_key))
    api_client.set_async_httpx_client(user_client)

    try:
        assert api_client.get_async_httpx_client() is user_client
    finally:
        await user_client.aclose()


@pytest.mark.asyncio
async def test_direct_api_client_preserves_async_environment_proxy(
    test_api_key, monkeypatch
):
    set_only_https_proxy(monkeypatch, "http://127.0.0.1:9999")
    api_client = ApiClient(ConnectionConfig(api_key=test_api_key), verify_ssl=False)
    httpx_client = api_client.get_async_httpx_client()

    try:
        transport = httpx_client._transport_for_url(httpx.URL("https://example.com"))
        assert isinstance(transport, _TCPKeepaliveTransport)
        assert transport is not httpx_client._transport
        assert (
            get_transport_option(transport._async_transport, "_proxy_url").origin.host
            == b"127.0.0.1"
        )
    finally:
        await httpx_client.aclose()


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
        assert get_transport_option(http2_transport, "_http2") is True
        assert get_transport_option(http1_transport, "_http2") is False
        # Subsequent calls with the same http2 flag return the cached
        # instance.
        assert get_async_transport(config) is http2_transport
        assert get_async_transport(config, http2=False) is http1_transport
    finally:
        AsyncTransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_async_get_transport_keyed_by_proxy(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    proxied_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )
    direct_config = ConnectionConfig(api_key=test_api_key)

    try:
        proxied_transport = get_async_transport(proxied_config)
        direct_transport = get_async_transport(direct_config)

        assert proxied_transport is not direct_transport
        # The same proxy still reuses the cached instance.
        assert get_async_transport(proxied_config) is proxied_transport
        assert get_async_transport(direct_config) is direct_transport
    finally:
        AsyncTransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_async_api_client_applies_request_timeout(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=1.5)

    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(1.5)
    finally:
        await httpx_client.aclose()
        AsyncTransportWithLogger._instances.clear()


@pytest.mark.asyncio
async def test_async_api_client_cache_reuses_within_loop_and_isolates_across_loops(
    test_api_key,
):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key)
    api_client = get_async_api_client(config)

    async def get_client_ids():
        httpx_client = api_client.get_async_httpx_client()
        try:
            return (
                id(httpx_client),
                id(api_client.get_async_httpx_client()),
                id(httpx_client._transport),
                id(get_async_transport(config)),
            )
        finally:
            await httpx_client.aclose()

    try:
        main_client = api_client.get_async_httpx_client()
        (
            worker_client_id,
            worker_cached_client_id,
            worker_transport_id,
            worker_cached_transport_id,
        ) = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: asyncio.run(get_client_ids()),
        )

        assert api_client.get_async_httpx_client() is main_client
        assert worker_client_id == worker_cached_client_id
        assert worker_transport_id == worker_cached_transport_id
        assert worker_client_id != id(main_client)
        assert worker_transport_id != id(main_client._transport)
    finally:
        await main_client.aclose()
        AsyncTransportWithLogger._instances.clear()


def test_async_transport_not_reused_across_sequential_loops(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key)

    async def get_transport():
        return get_async_transport(config)

    try:
        loop_a = asyncio.new_event_loop()
        try:
            transport_a = loop_a.run_until_complete(get_transport())
        finally:
            loop_a.close()
        del loop_a
        gc.collect()

        # The cache entry dies with the loop, so a later loop can never
        # inherit a transport bound to a closed loop, even when CPython
        # reuses the dead loop's object id.
        assert len(AsyncTransportWithLogger._instances) == 0

        loop_b = asyncio.new_event_loop()
        try:
            transport_b = loop_b.run_until_complete(get_transport())
        finally:
            loop_b.close()

        assert transport_b is not transport_a
    finally:
        AsyncTransportWithLogger._instances.clear()


def test_async_api_client_not_reused_across_sequential_loops(test_api_key):
    AsyncTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key)
    api_client = get_async_api_client(config)

    async def get_client():
        client = api_client.get_async_httpx_client()
        assert api_client.get_async_httpx_client() is client
        return client

    try:
        loop_a = asyncio.new_event_loop()
        try:
            client_a = loop_a.run_until_complete(get_client())
            loop_a.run_until_complete(client_a.aclose())
        finally:
            loop_a.close()
        del loop_a
        gc.collect()

        assert len(api_client._async_clients) == 0

        loop_b = asyncio.new_event_loop()
        try:
            client_b = loop_b.run_until_complete(get_client())
            loop_b.run_until_complete(client_b.aclose())
        finally:
            loop_b.close()

        assert client_b is not client_a
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
        assert get_transport_option(envd_transport, "_http2") is True
        assert (
            get_transport_option(envd_transport, "_socket_options")
            == _TCP_KEEPALIVE_SOCKET_OPTIONS
        )
    finally:
        AsyncTransportWithLogger._instances.clear()
        AsyncEnvdTransportWithLogger._instances.clear()
