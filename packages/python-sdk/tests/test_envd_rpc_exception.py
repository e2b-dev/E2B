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


def test_wraps_remote_protocol_error_in_sandbox_exception():
    err = handle_rpc_exception(
        httpcore.RemoteProtocolError(
            "<StreamReset stream_id:1, error_code:2, remote_reset:True>"
        )
    )
    assert isinstance(err, SandboxException)
    assert "StreamReset" in str(err)
    assert "The connection to the sandbox was terminated" in str(err)
    assert "killed" not in str(err)


def test_wraps_network_errors_in_sandbox_exception():
    err = handle_rpc_exception(httpcore.ReadError("read failed"))
    assert isinstance(err, SandboxException)
    assert "read failed" in str(err)


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
    assert isinstance(err, SandboxException)
    assert "sandbox was killed or reached its end of life" in str(err)
    assert "transient" not in str(err)


def test_health_check_running_falls_back_to_generic_exception():
    err = handle_rpc_exception_with_health(_stream_reset(), lambda: True)
    assert isinstance(err, SandboxException)
    assert "The connection to the sandbox was terminated" in str(err)
    assert "killed" not in str(err)


def test_health_check_unknown_falls_back_to_generic_exception():
    err = handle_rpc_exception_with_health(_stream_reset(), lambda: None)
    assert isinstance(err, SandboxException)
    assert "The connection to the sandbox was terminated" in str(err)
    assert "killed" not in str(err)


def test_health_check_failure_falls_back_to_generic_exception():
    def check():
        raise RuntimeError("health check failed")

    err = handle_rpc_exception_with_health(_stream_reset(), check)
    assert isinstance(err, SandboxException)
    assert "The connection to the sandbox was terminated" in str(err)
    assert "killed" not in str(err)


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
    assert isinstance(err, SandboxException)
    assert "sandbox was killed or reached its end of life" in str(err)


async def test_async_health_check_failure_falls_back_to_generic_exception():
    async def check():
        raise RuntimeError("health check failed")

    err = await ahandle_rpc_exception_with_health(_stream_reset(), check)
    assert isinstance(err, SandboxException)
    assert "The connection to the sandbox was terminated" in str(err)
    assert "killed" not in str(err)
