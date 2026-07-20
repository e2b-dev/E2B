import httpx
import pytest

from e2b.envd import transport
from e2b.envd.transport import proxy_to_url


@pytest.fixture(autouse=True)
def reset_transport_caches():
    transport._sync_transports.clear()
    transport._async_transports.clear()
    yield
    transport._sync_transports.clear()
    transport._async_transports.clear()


def test_proxy_to_url_none():
    assert proxy_to_url(None) is None


def test_proxy_to_url_str():
    assert proxy_to_url("http://127.0.0.1:8080") == "http://127.0.0.1:8080"


def test_proxy_to_url_httpx_url():
    assert proxy_to_url(httpx.URL("socks5://localhost:1080")) == (
        "socks5://localhost:1080"
    )


def test_proxy_to_url_keeps_credentials_from_url():
    assert proxy_to_url("http://user:pass@localhost:8030") == (
        "http://user:pass@localhost:8030"
    )


def test_proxy_to_url_folds_proxy_auth_into_url():
    proxy = httpx.Proxy("http://localhost:8030", auth=("user", "p@ss:word"))
    assert proxy_to_url(proxy) == "http://user:p%40ss%3Aword@localhost:8030"


def test_proxy_to_url_rejects_unknown_scheme():
    with pytest.raises(ValueError):
        proxy_to_url("ftp://localhost:8030")


def test_proxy_to_url_rejects_proxy_headers():
    proxy = httpx.Proxy("http://localhost:8030", headers={"X-Custom": "1"})
    with pytest.raises(ValueError, match="headers"):
        proxy_to_url(proxy)


def test_proxy_to_url_rejects_proxy_ssl_context():
    import ssl

    proxy = httpx.Proxy(
        "https://localhost:8030", ssl_context=ssl.create_default_context()
    )
    with pytest.raises(ValueError, match="ssl_context"):
        proxy_to_url(proxy)


def test_sync_transport_is_cached_per_proxy():
    transport_a = transport._get_sync_transport(None)
    transport_b = transport._get_sync_transport(None)
    transport_c = transport._get_sync_transport("http://127.0.0.1:8080")
    transport_d = transport._get_sync_transport("http://127.0.0.1:8080")

    assert transport_a is transport_b
    assert transport_c is transport_d
    assert transport_a is not transport_c


def test_async_transport_is_cached_per_proxy():
    transport_a = transport._get_async_transport(None)
    transport_b = transport._get_async_transport(None)
    transport_c = transport._get_async_transport("http://127.0.0.1:8080")

    assert transport_a is transport_b
    assert transport_a is not transport_c
    assert transport._get_sync_transport(None) is not transport_a
