import pytest

from e2b import ConnectionConfig
from e2b.api import ApiClient
from e2b.exceptions import AuthenticationException


def test_api_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("E2B_API_KEY", raising=False)
    config = ConnectionConfig()
    with pytest.raises(AuthenticationException, match=r"API key is required"):
        ApiClient(config)


@pytest.mark.parametrize("header", ["Authorization", "authorization"])
@pytest.mark.parametrize("env_api_key", [None, ""])
def test_api_client_accepts_authorization_header(monkeypatch, header, env_api_key):
    if env_api_key is None:
        monkeypatch.delenv("E2B_API_KEY", raising=False)
    else:
        monkeypatch.setenv("E2B_API_KEY", env_api_key)
    config = ConnectionConfig(
        api_headers={header: "Bearer access-token", "X-Team-ID": "team"}
    )

    client = ApiClient(config)
    headers = client.get_httpx_client().headers

    assert headers.get_list("Authorization") == ["Bearer access-token"]
    assert headers["X-Team-ID"] == "team"
    assert "X-API-KEY" not in headers


def test_api_client_prefers_api_key(monkeypatch):
    monkeypatch.delenv("E2B_API_KEY", raising=False)
    config = ConnectionConfig(api_key="e2b_key")

    headers = ApiClient(config).get_httpx_client().headers

    assert headers["X-API-KEY"] == "e2b_key"
    assert "Authorization" not in headers
