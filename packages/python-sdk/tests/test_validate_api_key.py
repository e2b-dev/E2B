import pytest

from e2b.api import ApiClient, validate_api_key
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import AuthenticationException


def test_accepts_well_formed_key(test_api_key):
    validate_api_key(test_api_key)


def test_rejects_missing_prefix():
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        validate_api_key("sk_" + "0" * 40)


def test_accepts_non_default_body_length():
    validate_api_key("e2b_" + "0" * 20)


def test_rejects_empty_body():
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        validate_api_key("e2b_")


def test_rejects_non_hex_body():
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        validate_api_key("e2b_" + "z" * 40)


def test_rejects_trailing_newline(test_api_key):
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        validate_api_key(test_api_key + "\n")


def test_error_message_includes_example_token(test_api_key):
    with pytest.raises(AuthenticationException) as exc_info:
        validate_api_key("nope")
    assert test_api_key in str(exc_info.value)


def test_api_client_accepts_non_standard_key_when_skip_enabled():
    config = ConnectionConfig(api_key="sk-" + "0" * 40, skip_api_key_validation=True)
    ApiClient(config)


def test_api_client_rejects_non_standard_key_by_default():
    config = ConnectionConfig(api_key="sk-" + "0" * 40)
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        ApiClient(config)
