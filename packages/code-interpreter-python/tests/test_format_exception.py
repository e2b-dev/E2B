from httpx import Response

from e2b import SandboxException
from e2b_code_interpreter.models import format_exception


def test_includes_the_response_body_in_server_errors():
    error = format_exception(Response(500, text="  R context failed to initialize  "))

    assert isinstance(error, SandboxException)
    assert str(error) == "500 Internal Server Error: R context failed to initialize"


def test_falls_back_to_the_reason_phrase_for_an_empty_body():
    error = format_exception(Response(500, text=""))

    assert isinstance(error, SandboxException)
    assert str(error) == "500 Internal Server Error"
