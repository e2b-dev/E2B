from types import SimpleNamespace

from e2b.api import api_exception_from_code, handle_api_exception
from e2b.exceptions import (
    RateLimitException,
    SandboxBusyException,
    SandboxException,
)


def response(status_code: int, content: bytes = b""):
    return SimpleNamespace(status_code=status_code, content=content, headers={})


def test_refused_pause_is_a_busy_exception_with_the_status_and_message():
    err = handle_api_exception(
        response(503, b'{"message":"node is busy persisting sandbox, please retry"}')
    )

    assert isinstance(err, SandboxBusyException)
    assert isinstance(err, SandboxException)
    assert err.status_code == 503
    assert "node is busy persisting sandbox" in str(err)


def test_503_without_a_body_is_still_a_busy_exception():
    err = handle_api_exception(response(503))

    assert isinstance(err, SandboxBusyException)
    assert err.status_code == 503


def test_generic_failure_stays_a_sandbox_exception_without_a_status():
    err = handle_api_exception(response(500, b'{"message":"Internal error"}'))

    assert isinstance(err, SandboxException)
    assert not isinstance(err, SandboxBusyException)
    assert err.status_code is None
    assert str(err) == "500: Internal error"


def test_rate_limit_carries_429():
    err = api_exception_from_code(429, "slow down")

    assert isinstance(err, RateLimitException)
    assert err.status_code == 429
