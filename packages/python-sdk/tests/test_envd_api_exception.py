import httpx

from e2b.envd.api import (
    format_envd_api_exception,
    get_message,
    handle_envd_api_exception,
    handle_envd_api_transport_exception,
)
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


def _json_response(status_code: int, content: bytes) -> httpx.Response:
    return httpx.Response(
        status_code, content=content, headers={"content-type": "application/json"}
    )


def test_get_message_uses_a_json_string_body():
    assert (
        get_message(_json_response(502, b'"upstream connect error"'))
        == "upstream connect error"
    )


def test_get_message_falls_back_to_text_for_a_non_dict_non_string_body():
    # Arrays and scalars carry no "message"; fall back to the raw text rather
    # than raising AttributeError.
    assert get_message(_json_response(502, b"[1, 2]")) == "[1, 2]"


def test_non_dict_json_error_body_maps_without_crashing():
    err = handle_envd_api_exception(_json_response(502, b'"upstream connect error"'))
    assert isinstance(err, TimeoutException)
    assert "upstream connect error" in str(err)
