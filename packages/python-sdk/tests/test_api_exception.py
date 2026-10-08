from types import SimpleNamespace

from e2b.api import api_exception_from_code, handle_api_exception
from e2b.exceptions import (
    RateLimitException,
    ServiceBusyException,
    SandboxException,
)


def response(status_code: int, content: bytes = b""):
    return SimpleNamespace(status_code=status_code, content=content, headers={})


def test_refused_pause_is_a_busy_exception_with_the_status_and_message():
    err = handle_api_exception(
        response(503, b'{"message":"node is busy persisting sandbox, please retry"}')
    )

    assert isinstance(err, ServiceBusyException)
    assert err.status_code == 503
    assert "node is busy persisting sandbox" in str(err)


def test_503_without_a_body_is_still_a_busy_exception():
    err = handle_api_exception(response(503))

    assert isinstance(err, ServiceBusyException)
    assert err.status_code == 503


def test_generic_failure_stays_a_sandbox_exception_and_carries_its_status():
    err = handle_api_exception(response(500, b'{"message":"Internal error"}'))

    assert isinstance(err, SandboxException)
    assert err.status_code == 500
    assert str(err) == "500: Internal error"


def test_generic_failure_without_a_body_carries_its_status():
    err = handle_api_exception(response(502, b"bad gateway"))

    assert isinstance(err, SandboxException)
    assert err.status_code == 502


def test_503_is_a_busy_exception_whatever_class_the_caller_asked_for():
    class BuildLikeException(SandboxException):
        pass

    err = handle_api_exception(
        response(503, b'{"message":"no capacity"}'),
        default_exception_class=BuildLikeException,
    )

    assert isinstance(err, ServiceBusyException)
    assert err.status_code == 503


def test_exceptions_that_bypass_the_initializer_still_expose_the_status():
    from e2b.sandbox.commands.command_handle import CommandExitException

    err = CommandExitException(stdout="", stderr="boom", exit_code=1, error="boom")

    assert isinstance(err, SandboxException)
    assert err.status_code is None


def test_rate_limit_carries_429():
    err = api_exception_from_code(429, "slow down")

    assert isinstance(err, RateLimitException)
    assert err.status_code == 429
