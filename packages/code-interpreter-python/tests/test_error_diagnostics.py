from httpx import Response

from e2b_code_interpreter.models import format_exception


def test_preserves_response_details_and_trace_id_for_server_errors():
    error = format_exception(
        Response(
            500,
            text="R context failed to initialize",
            headers={"X-E2B-Trace-ID": "trace-123"},
        )
    )

    assert str(error) == "500: R context failed to initialize (trace_id=trace-123)"


def test_keeps_existing_message_without_server_diagnostics():
    error = format_exception(Response(500, text=""))

    assert str(error) == "500:"
