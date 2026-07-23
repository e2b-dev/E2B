import asyncio
from http import HTTPStatus

import httpx
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from packaging.version import Version
from pyqwest import StreamError, StreamErrorCode

from e2b.connection_config import ConnectionConfig
from e2b.envd.rpc import (
    ahandle_rpc_exception_with_health,
    handle_rpc_exception,
    handle_rpc_exception_with_health,
    is_transport_failure,
    rpc_error_code,
)
from e2b.sandbox_async.commands.command import Commands
from e2b.sandbox_async.filesystem.filesystem import Filesystem
from e2b.exceptions import (
    AuthenticationException,
    InvalidArgumentException,
    NotFoundException,
    RateLimitException,
    SandboxException,
    TimeoutException,
)


def test_maps_invalid_argument():
    err = handle_rpc_exception(ConnectError(Code.INVALID_ARGUMENT, "bad"))
    assert isinstance(err, InvalidArgumentException)


def test_maps_unauthenticated():
    err = handle_rpc_exception(ConnectError(Code.UNAUTHENTICATED, "nope"))
    assert isinstance(err, AuthenticationException)


def test_maps_not_found():
    err = handle_rpc_exception(ConnectError(Code.NOT_FOUND, "missing"))
    assert isinstance(err, NotFoundException)


def test_maps_resource_exhausted_to_rate_limit():
    err = handle_rpc_exception(ConnectError(Code.RESOURCE_EXHAUSTED, "too many"))
    assert isinstance(err, RateLimitException)
    assert "Rate limit" in str(err)


def test_maps_unavailable_to_timeout():
    err = handle_rpc_exception(ConnectError(Code.UNAVAILABLE, "gone"))
    assert isinstance(err, TimeoutException)


def test_maps_deadline_exceeded_to_timeout():
    # connectrpc raises DEADLINE_EXCEEDED both for a client-enforced deadline
    # (`request_timeout` on unary calls, `timeout` on streams) and for the
    # server-side `connect-timeout-ms` deadline.
    err = handle_rpc_exception(ConnectError(Code.DEADLINE_EXCEEDED, "timed out"))
    assert isinstance(err, TimeoutException)


def test_falls_back_to_sandbox_exception():
    err = handle_rpc_exception(ConnectError(Code.INTERNAL, "boom"))
    assert isinstance(err, SandboxException)


def test_returns_original_when_not_connect_error():
    original = ValueError("not connect")
    err = handle_rpc_exception(original)
    assert err is original


def _stream_reset() -> ConnectError:
    # connectrpc wraps transport-level failures (e.g. an HTTP/2 RST_STREAM)
    # in a ConnectError with the original exception as __cause__.
    try:
        raise ConnectError(Code.UNAVAILABLE, "stream reset by peer") from OSError(
            "stream reset"
        )
    except ConnectError as e:
        return e


def _cancelled() -> ConnectError:
    # connectrpc converts asyncio cancellation into ConnectError(CANCELED)
    # with the CancelledError as __cause__.
    try:
        raise ConnectError(Code.CANCELED, "Request was cancelled") from (
            asyncio.CancelledError()
        )
    except ConnectError as e:
        return e


def _decode_failure() -> ConnectError:
    # connectrpc's catch-all wraps a 200 response whose body fails to decode
    # the same way it wraps transport errors: ConnectError(UNAVAILABLE) with
    # the original exception as __cause__.
    try:
        raise ConnectError(Code.UNAVAILABLE, "bad json") from ValueError("bad json")
    except ConnectError as e:
        return e


def test_transport_failure_detection():
    assert is_transport_failure(_stream_reset())
    # An HTTP/2 stream reset surfaces as a pyqwest StreamError cause.
    try:
        raise ConnectError(Code.INTERNAL, "reset") from StreamError(
            "reset", StreamErrorCode.INTERNAL_ERROR
        )
    except ConnectError as e:
        assert is_transport_failure(e)
    # Errors parsed from an envd response have no cause.
    assert not is_transport_failure(ConnectError(Code.UNAVAILABLE, "502"))
    # A client-side decode failure carries a cause, but the request was
    # delivered — probing health would be wrong.
    assert not is_transport_failure(_decode_failure())
    # A client-enforced deadline carries a cause but is a definitive result.
    try:
        raise ConnectError(Code.DEADLINE_EXCEEDED, "Request timed out") from (
            TimeoutError()
        )
    except ConnectError as e:
        assert not is_transport_failure(e)
    # Asyncio cancellation is not a connection failure — it must not
    # trigger a health probe.
    assert not is_transport_failure(_cancelled())
    assert not is_transport_failure(ValueError("other"))


def test_decode_failure_surfaces_original_error():
    err = _decode_failure()
    restored = handle_rpc_exception(err)
    assert restored is err.__cause__
    assert isinstance(restored, ValueError)


def test_health_check_not_run_for_decode_failure():
    def fail():
        raise AssertionError("health check should not run")

    restored = handle_rpc_exception_with_health(_decode_failure(), fail)
    assert isinstance(restored, ValueError)


def test_plain_http_429_maps_to_rate_limit():
    # A plain (non-Connect-encoded) HTTP 429 from an edge proxy: connectrpc
    # maps it to UNAVAILABLE with the reason phrase as the message.
    err = handle_rpc_exception(ConnectError(Code.UNAVAILABLE, "Too Many Requests"))
    assert isinstance(err, RateLimitException)
    assert "Rate limit" in str(err)


def test_plain_http_404_maps_to_not_found():
    err = handle_rpc_exception(ConnectError(Code.UNIMPLEMENTED, "Not Found"))
    assert isinstance(err, NotFoundException)


def test_plain_http_400_maps_to_invalid_argument():
    err = handle_rpc_exception(ConnectError(Code.INTERNAL, "Bad Request"))
    assert isinstance(err, InvalidArgumentException)


def test_plain_http_413_maps_to_rate_limit():
    err = handle_rpc_exception(ConnectError(Code.UNKNOWN, HTTPStatus(413).phrase))
    assert isinstance(err, RateLimitException)


def test_unimplemented_with_other_message_stays_generic():
    err = handle_rpc_exception(ConnectError(Code.UNIMPLEMENTED, "unknown method"))
    assert isinstance(err, SandboxException)
    assert not isinstance(err, NotFoundException)


def test_rpc_error_code_restores_the_vendored_status_table():
    # connectrpc maps plain (non-Connect-encoded) HTTP error responses per
    # the Connect spec with the synthesized reason phrase as the message;
    # rpc_error_code must restore the vendored client's status table (#806).
    # Building the errors through connectrpc's own plain-response path keeps
    # this pinned against upstream mapping or phrase changes.
    from connectrpc._protocol import ConnectWireError

    vendored_table = {
        400: Code.INVALID_ARGUMENT,
        401: Code.UNAUTHENTICATED,
        403: Code.PERMISSION_DENIED,
        404: Code.NOT_FOUND,
        409: Code.ALREADY_EXISTS,
        413: Code.RESOURCE_EXHAUSTED,
        429: Code.RESOURCE_EXHAUSTED,
        499: Code.CANCELED,
        500: Code.INTERNAL,
        501: Code.UNIMPLEMENTED,
        502: Code.UNAVAILABLE,
        503: Code.UNAVAILABLE,
        504: Code.DEADLINE_EXCEEDED,
        505: Code.UNIMPLEMENTED,
        418: Code.UNKNOWN,  # unmapped statuses stay unknown, as before
    }
    for status, code in vendored_table.items():
        err = ConnectWireError.from_http_status(status).to_exception()
        assert rpc_error_code(err) is code, f"HTTP {status}"


def test_rpc_error_code_keeps_envd_codes():
    # Errors parsed from a Connect response body carry envd's own message and
    # never match the synthesized reason phrases.
    assert rpc_error_code(ConnectError(Code.NOT_FOUND, "no process")) is Code.NOT_FOUND
    assert rpc_error_code(ConnectError(Code.UNIMPLEMENTED, "nope")) is (
        Code.UNIMPLEMENTED
    )
    assert rpc_error_code(ConnectError(Code.UNAVAILABLE, "gone")) is Code.UNAVAILABLE
    assert rpc_error_code(ConnectError(Code.UNKNOWN, "boom")) is Code.UNKNOWN


def test_cancellation_restores_cancelled_error():
    err = _cancelled()
    restored = handle_rpc_exception(err)
    assert restored is err.__cause__
    assert isinstance(restored, asyncio.CancelledError)


def test_health_check_not_run_for_cancellation():
    def fail():
        raise AssertionError("health check should not run")

    restored = handle_rpc_exception_with_health(_cancelled(), fail)
    assert isinstance(restored, asyncio.CancelledError)


def test_returns_raw_transport_failure_without_health_result():
    original = _stream_reset()
    err = handle_rpc_exception(original)
    assert err is original


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
        ConnectError(Code.NOT_FOUND, "missing"), fail
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


class _RaisingRpc:
    """Stand-in for a generated RPC client whose every call raises."""

    def __init__(self, error: Exception):
        self._error = error

    def __getattr__(self, name):
        async def call(*args, **kwargs):
            raise self._error

        return call


def _commands(error: Exception) -> Commands:
    commands = Commands(
        "http://127.0.0.1:1",
        ConnectionConfig(api_key="e2b_" + "0" * 40),
        Version("0.5.0"),
        httpx.AsyncClient(),
    )
    commands._rpc = _RaisingRpc(error)
    return commands


def _filesystem(error: Exception) -> Filesystem:
    filesystem = Filesystem(
        "http://127.0.0.1:1",
        Version("0.5.0"),
        ConnectionConfig(api_key="e2b_" + "0" * 40),
        httpx.AsyncClient(),
    )
    filesystem._rpc = _RaisingRpc(error)
    return filesystem


# The call sites that branch on the error code before mapping the exception
# must see the restored codes too, so a gateway answering with a plain HTTP
# error behaves like envd's own response (the vendored client's behavior).


async def test_kill_returns_false_on_plain_http_404():
    commands = _commands(ConnectError(Code.UNIMPLEMENTED, "Not Found"))
    assert await commands.kill(pid=1) is False


async def test_exists_returns_false_on_plain_http_404():
    filesystem = _filesystem(ConnectError(Code.UNIMPLEMENTED, "Not Found"))
    assert await filesystem.exists("/does/not/matter") is False


async def test_make_dir_returns_false_on_plain_http_409():
    filesystem = _filesystem(ConnectError(Code.UNKNOWN, "Conflict"))
    assert await filesystem.make_dir("/does/not/matter") is False
