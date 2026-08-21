import httpx

from e2b.api import handle_api_exception
from e2b.envd.api import ahandle_envd_api_exception, handle_envd_api_exception
from e2b.exceptions import (
    AuthenticationException,
    BuildException,
    NotFoundException,
    RateLimitException,
    SandboxException,
    TimeoutException,
    VolumeException,
)
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.trace_id import extract_trace_id


class FakeApiResponse:
    def __init__(self, status_code, content, headers=None):
        self.status_code = status_code
        self.content = content
        self.headers = headers


def _caller_traceback():
    try:
        raise ValueError("boom")
    except ValueError as e:
        return e.__traceback__


def test_extract_returns_none_without_headers():
    assert extract_trace_id() is None
    assert extract_trace_id(None) is None
    assert extract_trace_id({}) is None


def test_extract_returns_none_when_no_trace_header_present():
    assert extract_trace_id({"content-type": "text"}) is None


def test_extract_reads_x_trace_id_verbatim():
    assert extract_trace_id({"X-Trace-ID": "abc123"}) == "abc123"


def test_extract_is_case_insensitive():
    assert extract_trace_id({"x-trace-id": "abc123"}) == "abc123"


def test_extract_ignores_empty_x_trace_id():
    assert extract_trace_id({"X-Trace-ID": "  "}) is None


def test_extract_reads_gcp_trace_context():
    headers = {"X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/1;o=1"}
    assert extract_trace_id(headers) == "105445aa7843bc8bf206b12000100000"


def test_extract_normalizes_aws_trace_id():
    headers = {"X-Amzn-Trace-Id": "Root=1-5759e988-bd862e3fe1be46a994272793;Sampled=1"}
    assert extract_trace_id(headers) == "5759e988bd862e3fe1be46a994272793"


def test_extract_falls_back_to_raw_aws_root_value():
    assert extract_trace_id({"X-Amzn-Trace-Id": "Root=custom-value"}) == "custom-value"


def test_extract_prefers_x_trace_id_over_edge_headers():
    headers = {
        "X-Trace-ID": "explicit",
        "X-Cloud-Trace-Context": "105445aa7843bc8bf206b12000100000/1;o=1",
        "X-Amzn-Trace-Id": "Root=1-5759e988-bd862e3fe1be46a994272793",
    }
    assert extract_trace_id(headers) == "explicit"


def test_exception_appends_trace_id_to_message():
    err = SandboxException("500: failure", trace_id="abc123")
    assert str(err) == "500: failure (trace ID: abc123)"


def test_exception_leaves_message_unchanged_without_trace_id():
    err = SandboxException("500: failure")
    assert str(err) == "500: failure"


def test_authentication_exception_appends_trace_id():
    err = AuthenticationException("unauthorized", trace_id="abc123")
    assert str(err) == "unauthorized (trace ID: abc123)"


def test_subclasses_append_trace_id():
    err = TimeoutException("timed out", trace_id="abc123")
    assert str(err) == "timed out (trace ID: abc123)"


def test_trace_id_is_readable_as_an_attribute():
    assert SandboxException("500: failure", trace_id="abc123").trace_id == "abc123"
    assert TimeoutException("timed out", trace_id="abc123").trace_id == "abc123"
    assert AuthenticationException("unauthorized", trace_id="abc123").trace_id == (
        "abc123"
    )
    assert BuildException("build failed", trace_id="abc123").trace_id == "abc123"
    assert VolumeException("volume failed", trace_id="abc123").trace_id == "abc123"


def test_trace_id_attribute_is_none_when_there_is_none():
    assert SandboxException("500: failure").trace_id is None


def test_command_exit_exception_exposes_the_attribute():
    # The dataclass subclass generates its own __init__, so the attribute comes
    # from the class-level default
    err = CommandExitException(stderr="err", stdout="out", exit_code=1, error=None)
    assert err.trace_id is None


def test_api_exception_includes_trace_id():
    res = FakeApiResponse(
        500, b'{"message": "Internal error"}', {"X-Trace-ID": "abc123"}
    )
    err = handle_api_exception(res)
    assert isinstance(err, SandboxException)
    assert "(trace ID: abc123)" in str(err)
    assert err.trace_id == "abc123"


def test_api_exception_includes_trace_id_for_rate_limit():
    res = FakeApiResponse(429, b"", {"X-Trace-ID": "abc123"})
    err = handle_api_exception(res)
    assert isinstance(err, RateLimitException)
    assert "(trace ID: abc123)" in str(err)


def test_api_exception_without_headers():
    res = FakeApiResponse(500, b'{"message": "Internal error"}')
    err = handle_api_exception(res)
    assert isinstance(err, SandboxException)
    assert "trace ID" not in str(err)
    assert err.trace_id is None


def test_api_exception_applies_the_stack_trace():
    stack_trace = _caller_traceback()
    res = FakeApiResponse(500, b'{"message": "Internal error"}')
    err = handle_api_exception(res, stack_trace=stack_trace)
    assert err.__traceback__ is stack_trace


def test_authentication_exception_applies_the_stack_trace():
    stack_trace = _caller_traceback()
    res = FakeApiResponse(401, b'{"message": "Invalid token"}')
    err = handle_api_exception(res, stack_trace=stack_trace)
    assert isinstance(err, AuthenticationException)
    assert err.__traceback__ is stack_trace


def test_rate_limit_exception_applies_the_stack_trace():
    stack_trace = _caller_traceback()
    res = FakeApiResponse(429, b'{"message": "Too many requests"}')
    err = handle_api_exception(res, stack_trace=stack_trace)
    assert isinstance(err, RateLimitException)
    assert err.__traceback__ is stack_trace


def test_envd_api_exception_includes_trace_id():
    res = httpx.Response(
        404,
        text="Not found",
        headers={"X-Trace-ID": "abc123"},
        request=httpx.Request("GET", "http://sandbox/files"),
    )
    err = handle_envd_api_exception(res)
    assert isinstance(err, NotFoundException)
    assert "(trace ID: abc123)" in str(err)


def test_envd_api_exception_appends_trace_id_at_the_end():
    res = httpx.Response(
        502,
        text="Bad gateway",
        headers={"X-Trace-ID": "abc123"},
        request=httpx.Request("GET", "http://sandbox/files"),
    )
    err = handle_envd_api_exception(res)
    assert str(err).endswith("(trace ID: abc123)")


def test_envd_api_exception_without_trace_headers():
    res = httpx.Response(
        500,
        text="Internal error",
        request=httpx.Request("GET", "http://sandbox/files"),
    )
    err = handle_envd_api_exception(res)
    assert "trace ID" not in str(err)


async def test_async_envd_api_exception_includes_trace_id():
    res = httpx.Response(
        404,
        text="Not found",
        headers={"X-Trace-ID": "abc123"},
        request=httpx.Request("GET", "http://sandbox/files"),
    )
    err = await ahandle_envd_api_exception(res)
    assert isinstance(err, NotFoundException)
    assert "(trace ID: abc123)" in str(err)
