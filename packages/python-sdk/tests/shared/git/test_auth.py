import pytest

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox._git import with_credentials


def test_with_credentials_percent_encodes_reserved_characters():
    # Reserved characters in user/password must be percent-encoded so the
    # credential URL stays well-formed (parity with the JS SDK's WHATWG URL).
    assert (
        with_credentials("https://github.com/o/r.git", "user", "p@ss/w:rd")
        == "https://user:p%40ss%2Fw%3Ard@github.com/o/r.git"
    )
    assert (
        with_credentials("https://github.com/o/r.git", "user", "x#y?z")
        == "https://user:x%23y%3Fz@github.com/o/r.git"
    )
    assert (
        with_credentials("https://github.com/o/r.git", "git", "t/k@n")
        == "https://git:t%2Fk%40n@github.com/o/r.git"
    )


def test_with_credentials_keeps_alphanumeric_token_unchanged():
    assert (
        with_credentials("https://github.com/o/r.git", "user", "ghp_AbC123")
        == "https://user:ghp_AbC123@github.com/o/r.git"
    )


def test_with_credentials_without_credentials_passes_url_through():
    assert with_credentials("https://github.com/o/r.git", None, None) == (
        "https://github.com/o/r.git"
    )


def test_with_credentials_requires_both_parts():
    with pytest.raises(InvalidArgumentException):
        with_credentials("https://github.com/o/r.git", "user", None)
    with pytest.raises(InvalidArgumentException):
        with_credentials("https://github.com/o/r.git", None, "token")


def test_with_credentials_rejects_non_http_urls():
    with pytest.raises(InvalidArgumentException):
        with_credentials("ssh://git@github.com/o/r.git", "user", "token")
