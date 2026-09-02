import httpx

from e2b.api import handle_api_exception
from e2b.envd.api import handle_envd_api_exception
from e2b.exceptions import RateLimitException


class _ApiError:
    def __init__(self, headers=None):
        self.status_code = 429
        self.content = b'{"message":"too many requests"}'
        self.headers = headers or {}


def test_api_rate_limit_preserves_retry_after_header():
    err = handle_api_exception(_ApiError({"Retry-After": "60"}))

    assert isinstance(err, RateLimitException)
    assert err.retry_after == 60
    assert err.retry_after_header == "60"
    assert "Retry after 60 seconds" in str(err)


def test_envd_rate_limit_preserves_retry_after_header():
    res = httpx.Response(
        429,
        json={"message": "too many requests"},
        headers={"Retry-After": "45"},
    )

    err = handle_envd_api_exception(res)

    assert isinstance(err, RateLimitException)
    assert err.retry_after == 45
    assert err.retry_after_header == "45"
    assert "Retry after 45 seconds" in str(err)


def test_api_rate_limit_without_retry_after_has_no_wait():
    err = handle_api_exception(_ApiError())

    assert isinstance(err, RateLimitException)
    assert err.retry_after is None
    assert err.retry_after_header is None
    assert "Retry after" not in str(err)


def test_parse_retry_after_delta_seconds_and_http_date():
    from e2b.exceptions import parse_retry_after

    assert parse_retry_after("60") == 60
    assert parse_retry_after(None) is None
    assert parse_retry_after("not-a-retry-after") is None

    wait = parse_retry_after("Wed, 21 Oct 2015 07:28:00 GMT")
    assert wait == 0
