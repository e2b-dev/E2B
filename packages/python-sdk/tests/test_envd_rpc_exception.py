import httpcore

from e2b_connect.client import Code, ConnectException
from e2b.envd.rpc import (
    ahandle_rpc_exception_with_health,
    handle_rpc_exception,
    handle_rpc_exception_with_health,
)
from e2b.exceptions import (
    AuthenticationException,
    InvalidArgumentException,
    NotFoundException,
    RateLimitException,
    SandboxException,
    TimeoutException,
)


def test_maps_invalid_argument():
    err = handle_rpc_exception(ConnectException(Code.invalid_argument, "bad"))
    assert isinstance(err, InvalidArgumentException)


def test_maps_unauthenticated():
    err = handle_rpc_exception(ConnectException(Code.unauthenticated, "nope"))
    assert isinstance(err, AuthenticationException)


def test_maps_not_found():
    err = handle_rpc_exception(ConnectException(Code.not_found, "missing"))
    assert isinstance(err, NotFoundException)


def test_maps_resource_exhausted_to_rate_limit():
    err = handle_rpc_exception(ConnectException(Code.resource_exhausted, "too many"))
    assert isinstance(err, RateLimitException)
    assert "Rate limit" in str(err)


def test_maps_unavailable_to_timeout():
    err = handle_rpc_exception(ConnectException(Code.unavailable, "gone"))
    assert isinstance(err, TimeoutException)


def test_falls_back_to_sandbox_exception():
    err = handle_rpc_exception(ConnectException(Code.internal, "boom"))
    assert isinstance(err, SandboxException)


def test_returns_raw_remote_protocol_error_without_health_result():
    original = httpcore.RemoteProtocolError(
        "<StreamReset stream_id:1, error_code:2, remote_reset:True>"
    )
    err = handle_rpc_exception(original)
    assert err is original


def test_returns_raw_network_errors():
    original = httpcore.ReadError("read failed")
    err = handle_rpc_exception(original)
    assert err is original


def test_maps_read_timeout_to_timeout():
    # A transport-level read timeout (e.g. a unary call exceeding `request_timeout`)
    # must surface as a TimeoutException rather than leaking the raw httpcore error.
    err = handle_rpc_exception(httpcore.ReadTimeout("the read operation timed out"))
    assert isinstance(err, TimeoutException)


def test_maps_connect_timeout_to_timeout():
    err = handle_rpc_exception(httpcore.ConnectTimeout("connect timed out"))
    assert isinstance(err, TimeoutException)


def test_returns_original_when_not_connect_exception():
    original = ValueError("not connect")
    err = handle_rpc_exception(original)
    assert err is original


def _stream_reset() -> httpcore.RemoteProtocolError:
    return httpcore.RemoteProtocolError(
        "<StreamReset stream_id:1, error_code:2, remote_reset:True>"
    )


def test_health_check_confirms_sandbox_killed():
    err = handle_rpc_exception_with_health(_stream_reset(), lambda: False)
    assert isinstance(err, TimeoutException)
    assert "sandbox was killed or reached its end of life" in str(err)


def test_health_check_running_returns_raw_error():
    original = _stream_reset()
    err = handle_rpc_exception_with_health(original, lambda: True)
    assert err is original


def test_health_check_unknown_returns_raw_error():
    original = _stream_reset()
    err = handle_rpc_exception_with_health(original, lambda: None)
    assert err is original


def test_health_check_failure_returns_raw_error():
    def check():
        raise RuntimeError("health check failed")

    original = _stream_reset()
    err = handle_rpc_exception_with_health(original, check)
    assert err is original


def test_health_check_not_run_for_other_exceptions():
    def fail():
        raise AssertionError("health check should not run")

    err = handle_rpc_exception_with_health(
        ConnectException(Code.not_found, "missing"), fail
    )
    assert isinstance(err, NotFoundException)


async def test_async_health_check_confirms_sandbox_killed():
    async def check():
        return False

    err = await ahandle_rpc_exception_with_health(_stream_reset(), check)
    assert isinstance(err, TimeoutException)
    assert "sandbox was killed or reached its end of life" in str(err)


async def test_async_health_check_failure_returns_raw_error():
    async def check():
        raise RuntimeError("health check failed")

    original = _stream_reset()
    err = await ahandle_rpc_exception_with_health(original, check)
    assert err is original
