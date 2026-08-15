from http import HTTPStatus

import httpx

from e2b.api import handle_api_exception
from e2b.api.client.types import Response
from e2b.envd.api import handle_envd_api_exception
from e2b.exceptions import RateLimitException
from e2b.http_utils import parse_retry_after


def test_parses_delta_seconds():
    assert parse_retry_after("120") == 120


def test_parses_delta_seconds_with_surrounding_whitespace():
    assert parse_retry_after(" 120 ") == 120


def test_parses_http_date():
    from datetime import datetime, timedelta, timezone
    from email.utils import format_datetime

    retry_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    header = format_datetime(retry_at, usegmt=True)

    parsed = parse_retry_after(header)
    assert parsed is not None
    assert 55 <= parsed <= 60


def test_rejects_negative_delta_seconds():
    assert parse_retry_after("-1") is None


def test_rejects_garbage():
    assert parse_retry_after("not a valid value") is None


def test_returns_none_for_missing_header():
    assert parse_retry_after(None) is None
    assert parse_retry_after("") is None


def test_handle_api_exception_preserves_retry_after():
    response = Response(
        status_code=HTTPStatus.TOO_MANY_REQUESTS,
        content=b'{"message": "Too many requests"}',
        headers={"Retry-After": " 60 "},
        parsed=None,
    )

    err = handle_api_exception(response)

    assert isinstance(err, RateLimitException)
    assert err.retry_after == 60


def test_handle_api_exception_ignores_invalid_retry_after():
    response = Response(
        status_code=HTTPStatus.TOO_MANY_REQUESTS,
        content=b'{"message": "Too many requests"}',
        headers={"Retry-After": "-1"},
        parsed=None,
    )

    err = handle_api_exception(response)

    assert isinstance(err, RateLimitException)
    assert err.retry_after is None


def test_handle_api_exception_without_headers_attribute():
    class LegacyResponse:
        status_code = 429
        content = b'{"message": "Too many requests"}'

    err = handle_api_exception(LegacyResponse())  # type: ignore[arg-type]  # deliberately missing `headers` to test the getattr fallback

    assert isinstance(err, RateLimitException)
    assert err.retry_after is None


def test_handle_envd_api_exception_preserves_retry_after():
    response = httpx.Response(
        429,
        json={"message": "Too many requests"},
        headers={"Retry-After": "60"},
    )

    err = handle_envd_api_exception(response)

    assert isinstance(err, RateLimitException)
    assert err.retry_after == 60
