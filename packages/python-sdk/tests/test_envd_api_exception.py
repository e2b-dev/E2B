from e2b.envd.api import format_envd_api_exception
from e2b.exceptions import (
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    NotFoundException,
    RateLimitException,
    SandboxException,
    TimeoutException,
)


def test_maps_400_to_invalid_argument():
    err = format_envd_api_exception(400, "Bad request")
    assert isinstance(err, InvalidArgumentException)


def test_maps_401_to_authentication():
    err = format_envd_api_exception(401, "Invalid token")
    assert isinstance(err, AuthenticationException)


def test_maps_404_to_not_found():
    err = format_envd_api_exception(404, "Not found")
    assert isinstance(err, NotFoundException)


def test_maps_429_to_rate_limit():
    err = format_envd_api_exception(429, "Too many requests")
    assert isinstance(err, RateLimitException)
    assert "rate limited" in str(err)


def test_maps_502_to_timeout():
    err = format_envd_api_exception(502, "Bad gateway")
    assert isinstance(err, TimeoutException)


def test_maps_507_to_not_enough_space():
    err = format_envd_api_exception(507, "No space left")
    assert isinstance(err, NotEnoughSpaceException)


def test_falls_back_to_sandbox_exception():
    err = format_envd_api_exception(500, "Internal error")
    assert isinstance(err, SandboxException)
    assert "500" in str(err)
