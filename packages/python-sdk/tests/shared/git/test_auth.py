from e2b.sandbox._git.auth import strip_credentials, with_credentials


def test_with_credentials_percent_encodes_special_characters():
    # URL-significant characters in the username/token must be percent-encoded
    # so they don't corrupt the URL (git would otherwise mis-parse the host).
    assert (
        with_credentials("https://github.com/o/r.git", "user", "p@ss")
        == "https://user:p%40ss@github.com/o/r.git"
    )
    assert (
        with_credentials("https://github.com/o/r.git", "us er", "a/b:c")
        == "https://us%20er:a%2Fb%3Ac@github.com/o/r.git"
    )


def test_with_credentials_round_trips_through_strip():
    url = with_credentials("https://github.com/o/r.git", "user", "p@ss")
    assert strip_credentials(url) == "https://github.com/o/r.git"


def test_with_credentials_without_credentials_returns_url_unchanged():
    assert (
        with_credentials("https://github.com/o/r.git", None, None)
        == "https://github.com/o/r.git"
    )
