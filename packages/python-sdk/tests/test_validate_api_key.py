import pytest

from e2b.api import validate_api_key
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


def test_accepts_custom_prefix():
    validate_api_key("myorg_" + "0" * 40, prefix="myorg_")


def test_rejects_when_prefix_does_not_match_custom_prefix():
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        validate_api_key("e2b_" + "0" * 40, prefix="myorg_")


def test_custom_prefix_appears_in_error_message():
    with pytest.raises(AuthenticationException) as exc_info:
        validate_api_key("nope", prefix="myorg_")
    assert "myorg_" in str(exc_info.value)
    assert "myorg_" + "0" * 40 in str(exc_info.value)


def test_escapes_regex_metacharacters_in_prefix():
    validate_api_key("my.org+" + "0" * 40, prefix="my.org+")
    with pytest.raises(AuthenticationException, match=r"Invalid API key format"):
        validate_api_key("myXorgY" + "0" * 40, prefix="my.org+")
