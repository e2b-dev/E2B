import pytest

from e2b.api import validate_api_key
from e2b.exceptions import AuthenticationException


VALID_KEY = "e2b_" + ("0123456789abcdef" * 2) + "01234567"


def test_accepts_well_formed_key():
    validate_api_key(VALID_KEY)


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


def test_error_message_includes_example_token():
    with pytest.raises(AuthenticationException) as exc_info:
        validate_api_key("nope")
    assert "e2b_" + "0" * 40 in str(exc_info.value)
