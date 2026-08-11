import httpx

from e2b.api import handle_api_exception
from e2b.envd.api import handle_envd_api_exception
from e2b.exceptions import RateLimitException


class ApiError:
    status_code = 429
    content = b'{"message":"too many requests"}'
    headers = {"Retry-After": "60"}


def test_api_rate_limit_preserves_retry_after_header():
    err = handle_api_exception(ApiError())

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
