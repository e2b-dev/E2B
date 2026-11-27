import pytest

from e2b.exceptions import InvalidArgumentException
from e2b.sandbox._git.auth import with_credentials


def test_with_credentials_replaces_https_userinfo():
    result = with_credentials("https://old:tok@github.com/o/r.git", "newuser", "newpw")
    assert result == "https://newuser:newpw@github.com/o/r.git"


def test_with_credentials_replaces_username_without_password():
    result = with_credentials("http://user@host/x", "newuser", "newpw")
    assert result == "http://newuser:newpw@host/x"


def test_with_credentials_on_url_without_credentials():
    result = with_credentials("https://github.com/o/r.git", "newuser", "newpw")
    assert result == "https://newuser:newpw@github.com/o/r.git"


def test_with_credentials_quotes_special_characters_in_password():
    result = with_credentials("https://github.com/o/r.git", "newuser", "p@ss:w/ord?")
    assert result == "https://newuser:p%40ss%3Aw%2Ford%3F@github.com/o/r.git"


def test_with_credentials_preserves_port():
    result = with_credentials("https://old:tok@host:8443/x", "newuser", "newpw")
    assert result == "https://newuser:newpw@host:8443/x"


def test_with_credentials_brackets_ipv6_host():
    result = with_credentials("https://[::1]:8443/x", "newuser", "newpw")
    assert result == "https://newuser:newpw@[::1]:8443/x"


def test_with_credentials_without_credentials_returns_url_unchanged():
    url = "https://old:tok@github.com/o/r.git"
    assert with_credentials(url, None, None) == url


def test_with_credentials_requires_both_username_and_password():
    with pytest.raises(InvalidArgumentException):
        with_credentials("https://github.com/o/r.git", "newuser", None)


def test_with_credentials_rejects_non_http_scheme():
    with pytest.raises(InvalidArgumentException):
        with_credentials("git://host/o/r.git", "newuser", "newpw")
