import httpcore

from e2b_connect.client import Code, ConnectException
from e2b.envd.rpc import handle_rpc_exception
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


def test_wraps_remote_protocol_error_with_terminated_message():
    err = handle_rpc_exception(
        httpcore.RemoteProtocolError(
            "<StreamReset stream_id:1, error_code:2, remote_reset:True>"
        )
    )
    assert isinstance(err, SandboxException)
    assert "sandbox was killed" in str(err)
    assert "is_running" in str(err)


def test_wraps_network_errors_in_sandbox_exception():
    err = handle_rpc_exception(httpcore.ReadError("read failed"))
    assert isinstance(err, SandboxException)
    assert "read failed" in str(err)


def test_returns_original_when_not_connect_exception():
    original = ValueError("not connect")
    err = handle_rpc_exception(original)
    assert err is original
