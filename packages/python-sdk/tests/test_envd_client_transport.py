from typing import cast

import httpx
import pytest
from pyqwest import Proxy
from transport_caches import reset_transport_caches

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
from e2b.api import ProxyConfig, proxy_to_config
from e2b.connection_config import ConnectionConfig, ProxyTypes
from e2b.envd import client_async, client_sync
from e2b.envd.process.process_connect import ProcessClient, ProcessClientSync
from e2b.exceptions import InvalidArgumentException


@pytest.fixture(autouse=True)
def clear_transport_caches():
    reset_transport_caches()
    yield
    reset_transport_caches()


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


def test_sync_pool_is_cached_per_proxy():
    proxy = ProxyConfig("http://127.0.0.1:8080")
    pool_a = api_client_sync.get_pyqwest_transport(None)
    pool_b = api_client_sync.get_pyqwest_transport(None)
    pool_c = api_client_sync.get_pyqwest_transport(proxy)
    # A second, equal config keys the same pool.
    pool_d = api_client_sync.get_pyqwest_transport(ProxyConfig("http://127.0.0.1:8080"))

    assert pool_a is pool_b
    assert pool_c is pool_d
    assert pool_a is not pool_c


def test_sync_pool_is_not_shared_across_proxy_credentials():
    # Same proxy URL, different credentials or headers: separate pools, since
    # the proxy configuration is fixed per transport.
    url = "http://127.0.0.1:8080"
    plain = api_client_sync.get_pyqwest_transport(ProxyConfig(url))
    with_auth = api_client_sync.get_pyqwest_transport(
        ProxyConfig(url, auth=("user", "pass"))
    )
    with_headers = api_client_sync.get_pyqwest_transport(
        ProxyConfig(url, headers=(("x-custom", "1"),))
    )

    assert plain is not with_auth
    assert plain is not with_headers
    assert with_auth is not with_headers


def test_async_pool_is_cached_per_proxy():
    pool_a = api_client_async.get_pyqwest_transport(None)
    pool_b = api_client_async.get_pyqwest_transport(None)
    pool_c = api_client_async.get_pyqwest_transport(
        ProxyConfig("http://127.0.0.1:8080")
    )

    assert pool_a is pool_b
    assert pool_a is not pool_c
    # Sync and async are separate stacks all the way down.
    assert api_client_sync.get_pyqwest_transport(None) is not pool_a


def test_rpc_clients_run_on_the_shared_pool(test_api_key, monkeypatch):
    # The RPC stack is the plain-HTTP-error normalization wrapping the very
    # pool the httpx clients use, so an envd RPC and an envd HTTP call to the
    # same sandbox share one HTTP/2 connection. `pyqwest.SyncClient` doesn't
    # hand its transport back, so record what the normalization is given.
    config = ConnectionConfig(api_key=test_api_key)
    pool = api_client_sync.get_pyqwest_transport(None)
    async_pool = api_client_async.get_pyqwest_transport(None)
    # The httpx adapters every REST client uses sit on those same pools.
    assert api_client_sync.get_httpx_transport(None)._transport is pool
    assert api_client_async.get_httpx_transport(None)._transport is async_pool

    wrapped = []
    for module in (client_sync, client_async):
        normalization = module.PlainHTTPErrorTransport
        monkeypatch.setattr(
            module,
            "PlainHTTPErrorTransport",
            lambda inner, normalization=normalization: (
                wrapped.append(inner) or normalization(inner)
            ),
        )

    client_sync.create_rpc_client(ProcessClientSync, "https://sandbox.e2b.app", config)
    client_async.create_rpc_client(ProcessClient, "https://sandbox.e2b.app", config)

    assert wrapped == [pool, async_pool]


def test_shared_pool_retries_connects():
    # `E2B_CONNECTION_RETRIES` must flow into the retry layer of the shared
    # pool, which every stack now inherits.
    from e2b.api import connection_retries

    pool = api_client_sync.get_pyqwest_transport(None)
    apool = api_client_async.get_pyqwest_transport(None)
    assert isinstance(pool, api_client_sync.ConnectionRetryTransport)
    assert isinstance(apool, api_client_async.ConnectionRetryTransport)
    assert pool._max_retries == connection_retries
    assert apool._max_retries == connection_retries
