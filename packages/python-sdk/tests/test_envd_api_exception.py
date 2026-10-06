import httpx

from e2b.envd.api import (
    acheck_sandbox_health,
    ahandle_envd_api_transport_exception_with_health,
    check_sandbox_health,
    format_envd_api_exception,
    handle_envd_api_transport_exception,
    handle_envd_api_transport_exception_with_health,
)
from e2b.exceptions import (
    AuthenticationException,
    InvalidArgumentException,
    NotEnoughSpaceException,
    NotFoundException,
    RateLimitException,
    SandboxException,
    SandboxUnreachableException,
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


def test_returns_raw_remote_protocol_error_without_health_result():
    original = httpx.RemoteProtocolError("peer closed connection")
    err = handle_envd_api_transport_exception(original)
    assert err is original


def test_returns_raw_network_errors():
    original = httpx.ReadError("read failed")
    err = handle_envd_api_transport_exception(original)
    assert err is original


def test_returns_original_when_not_transport_error():
    original = ValueError("not transport")
    err = handle_envd_api_transport_exception(original)
    assert err is original


def test_health_result_confirms_sandbox_killed():
    err = handle_envd_api_transport_exception(
        httpx.RemoteProtocolError("peer closed connection"), sandbox_running=False
    )
    assert isinstance(err, TimeoutException)
    assert "sandbox was killed or reached its end of life" in str(err)


def test_health_result_running_returns_raw_error():
    original = httpx.RemoteProtocolError("peer closed connection")
    err = handle_envd_api_transport_exception(original, sandbox_running=True)
    assert err is original


def _health_client(handler) -> httpx.Client:
    return httpx.Client(
        base_url="http://sandbox", transport=httpx.MockTransport(handler)
    )


def _ahealth_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url="http://sandbox", transport=httpx.MockTransport(handler)
    )


def _refuse(request: httpx.Request):
    raise httpx.ConnectError("connection refused", request=request)


def test_health_check_reports_running():
    with _health_client(lambda request: httpx.Response(204)) as client:
        assert check_sandbox_health(client) is True


def test_health_check_reports_sandbox_gone():
    with _health_client(lambda request: httpx.Response(502)) as client:
        assert check_sandbox_health(client) is False


def test_health_check_unknown_status_is_inconclusive():
    with _health_client(lambda request: httpx.Response(500)) as client:
        assert check_sandbox_health(client) is None


def test_health_check_raises_when_sandbox_unreachable():
    with _health_client(_refuse) as client:
        try:
            check_sandbox_health(client)
        except httpx.ConnectError:
            pass
        else:
            raise AssertionError("expected the probe to raise")


def test_connect_failure_with_sandbox_killed_returns_timeout():
    with _health_client(lambda request: httpx.Response(502)) as client:
        err = handle_envd_api_transport_exception_with_health(
            httpx.ConnectError("connection refused"), client
        )
    assert isinstance(err, TimeoutException)


def test_connect_failure_with_running_sandbox_returns_raw_error():
    original = httpx.ConnectError("connection refused")
    with _health_client(lambda request: httpx.Response(204)) as client:
        err = handle_envd_api_transport_exception_with_health(original, client)
    assert err is original


def test_connect_failure_with_unreachable_health_returns_unreachable():
    original = httpx.ConnectError("connection refused")
    with _health_client(_refuse) as client:
        err = handle_envd_api_transport_exception_with_health(original, client)
    assert isinstance(err, SandboxUnreachableException)
    assert "could not be reached" in str(err)
    assert err.__cause__ is original


def test_dropped_connection_with_unreachable_health_returns_unreachable():
    original = httpx.RemoteProtocolError("stream reset")
    with _health_client(_refuse) as client:
        err = handle_envd_api_transport_exception_with_health(original, client)
    assert isinstance(err, SandboxUnreachableException)


def test_non_transport_error_skips_health_check():
    def fail(request: httpx.Request):
        raise AssertionError("health check should not run")

    original = httpx.ReadTimeout("timed out")
    with _health_client(fail) as client:
        err = handle_envd_api_transport_exception_with_health(original, client)
    assert err is original


async def test_async_health_check_raises_when_sandbox_unreachable():
    async with _ahealth_client(_refuse) as client:
        try:
            await acheck_sandbox_health(client)
        except httpx.ConnectError:
            pass
        else:
            raise AssertionError("expected the probe to raise")


async def test_async_connect_failure_with_unreachable_health_returns_unreachable():
    original = httpx.ConnectError("connection refused")
    async with _ahealth_client(_refuse) as client:
        err = await ahandle_envd_api_transport_exception_with_health(original, client)
    assert isinstance(err, SandboxUnreachableException)
    assert err.__cause__ is original


async def test_async_connect_failure_with_sandbox_killed_returns_timeout():
    async with _ahealth_client(lambda request: httpx.Response(502)) as client:
        err = await ahandle_envd_api_transport_exception_with_health(
            httpx.ConnectError("connection refused"), client
        )
    assert isinstance(err, TimeoutException)
