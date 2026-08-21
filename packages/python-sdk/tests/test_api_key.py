import pytest

from e2b import ConnectionConfig
from e2b.api import ApiClient
from e2b.exceptions import AuthenticationException


def test_api_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("E2B_API_KEY", raising=False)
    config = ConnectionConfig()
    with pytest.raises(AuthenticationException, match=r"API key is required"):
        ApiClient(config)


def test_api_client_accepts_any_non_empty_key():
    config = ConnectionConfig(api_key="not-a-standard-key")
    # Should not raise: no client-side format validation.
    ApiClient(config)
