import httpx
import pytest

from e2b.envd import client_async, client_sync
from e2b.envd.client_shared import proxy_to_url
from e2b.exceptions import InvalidArgumentException


@pytest.fixture(autouse=True)
def reset_transport_caches():
    client_sync._transports.clear()
    client_async._transports.clear()
    yield
    client_sync._transports.clear()
    client_async._transports.clear()


def test_proxy_to_url_none():
    assert proxy_to_url(None) is None


def test_proxy_to_url_str():
    assert proxy_to_url("http://127.0.0.1:8080") == "http://127.0.0.1:8080"


def test_proxy_to_url_keeps_credentials_from_url():
    assert proxy_to_url("http://user:pass@localhost:8030") == (
        "http://user:pass@localhost:8030"
    )


def test_proxy_to_url_rejects_httpx_proxy():
    # A typed SDK exception, not a bare ValueError — `except SandboxException`
    # handlers must catch it when it surfaces from an RPC call.
    proxy = httpx.Proxy("http://localhost:8030", auth=("user", "pass"))
    with pytest.raises(InvalidArgumentException, match="URL-string"):
        proxy_to_url(proxy)


def test_proxy_to_url_rejects_httpx_url():
    with pytest.raises(InvalidArgumentException, match="URL-string"):
        proxy_to_url(httpx.URL("http://localhost:8030"))


def test_sync_transport_is_cached_per_proxy():
    transport_a = client_sync.get_transport(None)
    transport_b = client_sync.get_transport(None)
    transport_c = client_sync.get_transport("http://127.0.0.1:8080")
    transport_d = client_sync.get_transport("http://127.0.0.1:8080")

    assert transport_a is transport_b
    assert transport_c is transport_d
    assert transport_a is not transport_c


def test_async_transport_is_cached_per_proxy():
    transport_a = client_async.get_transport(None)
    transport_b = client_async.get_transport(None)
    transport_c = client_async.get_transport("http://127.0.0.1:8080")

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
    assert isinstance(sync_transport._inner, client_sync.ConnectionRetryTransport)
    assert isinstance(async_transport._inner, client_async.ConnectionRetryTransport)
    assert sync_transport._inner._max_retries == connection_retries
    assert async_transport._inner._max_retries == connection_retries
