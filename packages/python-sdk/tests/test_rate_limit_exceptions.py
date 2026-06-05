import httpx

from e2b.api import handle_api_exception
from e2b.envd.api import handle_envd_api_exception
from e2b.exceptions import RateLimitException


class ApiErrorResponse:
    status_code = 429
    content = b'{"message": "Too many requests"}'
    headers = {"Retry-After": " 60 "}


def test_api_rate_limit_exception_preserves_retry_after():
    err = handle_api_exception(ApiErrorResponse())

    assert isinstance(err, RateLimitException)
    assert err.retry_after == 60


def test_api_rate_limit_exception_ignores_invalid_retry_after():
    response = ApiErrorResponse()
    response.headers = {"Retry-After": "-1"}

    err = handle_api_exception(response)

    assert isinstance(err, RateLimitException)
    assert err.retry_after is None


def test_envd_rate_limit_exception_preserves_retry_after():
    response = httpx.Response(
        429,
        json={"message": "Too many requests"},
        headers={"Retry-After": "60"},
    )

    err = handle_envd_api_exception(response)

    assert isinstance(err, RateLimitException)
    assert err.retry_after == 60
