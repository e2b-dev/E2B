from typing import cast

import httpx
import pytest
from pyqwest import Proxy

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
from e2b.api import ProxyConfig, proxy_to_config
from e2b.connection_config import ProxyTypes
from e2b.envd import client_async, client_sync
from e2b.exceptions import InvalidArgumentException


@pytest.fixture(autouse=True)
def reset_transport_caches():
    client_sync._transports.clear()
    client_async._transports.clear()
    yield
    client_sync._transports.clear()
    client_async._transports.clear()


def test_proxy_to_config_none():
    assert proxy_to_config(None) is None


def test_proxy_to_config_str():
    assert proxy_to_config("http://127.0.0.1:8080") == ProxyConfig(
        "http://127.0.0.1:8080"
    )


def test_proxy_to_config_keeps_credentials_from_url():
    assert proxy_to_config("http://user:pass@localhost:8030") == ProxyConfig(
        "http://user:pass@localhost:8030"
    )


def test_proxy_to_config_converts_httpx_url():
    assert proxy_to_config(httpx.URL("http://localhost:8030")) == ProxyConfig(
        "http://localhost:8030"
    )


def test_proxy_to_config_converts_httpx_proxy_with_auth():
    # Credentials stay a separate (username, password) pair instead of being
    # percent-encoded back into the URL userinfo.
    proxy = httpx.Proxy("http://localhost:8030", auth=("user@x", "p@ss"))
    assert proxy_to_config(proxy) == ProxyConfig(
        "http://localhost:8030", auth=("user@x", "p@ss")
    )


def test_proxy_to_config_keeps_credentials_from_httpx_proxy_url():
    # httpx.Proxy pulls userinfo out of the URL into `.auth`, which is how
    # pyqwest takes it too.
    proxy = httpx.Proxy("http://user:pass@localhost:8030")
    assert proxy_to_config(proxy) == ProxyConfig(
        "http://localhost:8030", auth=("user", "pass")
    )


def test_proxy_to_config_carries_httpx_proxy_headers():
    proxy = httpx.Proxy("http://localhost:8030", headers={"X-Custom": "1"})
    assert proxy_to_config(proxy) == ProxyConfig(
        "http://localhost:8030", headers=(("x-custom", "1"),)
    )


def test_proxy_config_builds_a_pyqwest_proxy():
    config = ProxyConfig(
        "http://localhost:8030", auth=("user", "pass"), headers=(("x-custom", "1"),)
    )
    assert isinstance(config.to_pyqwest(), Proxy)
    # Equal configs are one cache key even though the Proxy objects they build
    # are not equal to each other.
    assert config == ProxyConfig(
        "http://localhost:8030", auth=("user", "pass"), headers=(("x-custom", "1"),)
    )
    assert config.to_pyqwest() != config.to_pyqwest()


def test_proxy_to_config_rejects_httpx_proxy_ssl_context():
    import ssl

    # Typed so `except SandboxException` handlers catch it at the RPC call.
    proxy = httpx.Proxy(
        "https://localhost:8030", ssl_context=ssl.create_default_context()
    )
    with pytest.raises(InvalidArgumentException, match="ssl_context"):
        proxy_to_config(proxy)


def test_proxy_to_config_rejects_unknown_types():
    with pytest.raises(InvalidArgumentException, match="URL-string"):
        proxy_to_config(cast(ProxyTypes, object()))


def test_sync_transport_is_cached_per_proxy():
    proxy = ProxyConfig("http://127.0.0.1:8080")
    transport_a = client_sync.get_transport(None)
    transport_b = client_sync.get_transport(None)
    transport_c = client_sync.get_transport(proxy)
    # A second, equal config keys the same pool.
    transport_d = client_sync.get_transport(ProxyConfig("http://127.0.0.1:8080"))

    assert transport_a is transport_b
    assert transport_c is transport_d
    assert transport_a is not transport_c


def test_sync_transport_is_not_shared_across_proxy_credentials():
    # Same proxy URL, different credentials or headers: separate pools, since
    # the proxy configuration is fixed per transport.
    url = "http://127.0.0.1:8080"
    plain = client_sync.get_transport(ProxyConfig(url))
    with_auth = client_sync.get_transport(ProxyConfig(url, auth=("user", "pass")))
    with_headers = client_sync.get_transport(
        ProxyConfig(url, headers=(("x-custom", "1"),))
    )

    assert plain is not with_auth
    assert plain is not with_headers
    assert with_auth is not with_headers


def test_async_transport_is_cached_per_proxy():
    transport_a = client_async.get_transport(None)
    transport_b = client_async.get_transport(None)
    transport_c = client_async.get_transport(ProxyConfig("http://127.0.0.1:8080"))

    assert transport_a is transport_b
    assert transport_a is not transport_c
    assert client_sync.get_transport(None) is not transport_a


def test_transport_stack_normalizes_plain_errors_and_retries_connects():
    # The shared transports are the plain-HTTP-error normalization wrapping
    # the connection retries; `E2B_CONNECTION_RETRIES` must flow into the
    # retry layer the way it does into the httpx REST transports.
    from e2b.api import connection_retries

    sync_transport = client_sync.get_transport(None)
    async_transport = client_async.get_transport(None)
    assert isinstance(sync_transport, client_sync.PlainHTTPErrorTransport)
    assert isinstance(async_transport, client_async.PlainHTTPErrorTransport)
    assert isinstance(sync_transport._inner, api_client_sync.ConnectionRetryTransport)
    assert isinstance(async_transport._inner, api_client_async.ConnectionRetryTransport)
    assert sync_transport._inner._max_retries == connection_retries
    assert async_transport._inner._max_retries == connection_retries
