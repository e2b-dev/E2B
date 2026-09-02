from httpx import Response
from types import SimpleNamespace

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.code_interpreter_sync import Sandbox
from e2b import NotFoundException, TimeoutException
from e2b_code_interpreter.models import format_exception


def test_preserves_response_details_and_trace_id_for_ci_server_errors():
    error = format_exception(
        Response(
            500,
            text="R context failed to initialize",
            headers={"X-E2B-Trace-ID": "trace-123"},
        ),
        include_diagnostics=True,
    )

    assert str(error) == "500: R context failed to initialize (trace_id=trace-123)"


def test_keeps_existing_message_outside_ci():
    error = format_exception(
        Response(
            500,
            text="R context failed to initialize",
            headers={"X-E2B-Trace-ID": "trace-123"},
        ),
        include_diagnostics=False,
    )

    assert str(error) == "500: R context failed to initialize"


def test_keeps_empty_generic_error_spacing_outside_ci():
    error = format_exception(Response(500, text=""), include_diagnostics=False)

    assert str(error) == "500: "


def test_preserves_non_ci_response_body_exactly():
    not_found = format_exception(
        Response(404, text="  missing  "), include_diagnostics=False
    )
    timeout = format_exception(
        Response(502, text="  timed out  "), include_diagnostics=False
    )

    assert isinstance(not_found, NotFoundException)
    assert str(not_found) == "  missing  "
    assert isinstance(timeout, TimeoutException)
    assert str(timeout) == (
        "  timed out  : This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeout' when starting the sandbox or calling '.set_timeout' on the sandbox with the desired timeout."
    )


def test_older_base_sdk_without_request_source_disables_diagnostics():
    sandbox = SimpleNamespace(connection_config=SimpleNamespace())

    assert Sandbox._include_diagnostics.fget(sandbox) is False
    assert AsyncSandbox._include_diagnostics.fget(sandbox) is False
