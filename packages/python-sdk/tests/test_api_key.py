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
    ApiClient(config)


def test_deprecated_validate_api_key_option_has_no_effect():
    config = ConnectionConfig(api_key="not-a-standard-key", validate_api_key=True)
    ApiClient(config)
