import pytest

from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_basic(sandbox: Sandbox):
    result = sandbox.run_code("x =1; x")
    assert result.text == "1"


@pytest.mark.skip_debug
def test_secure_access(sandbox_factory):
    sandbox = sandbox_factory(secure=True, network={"allow_public_traffic": False})
    # Create sandbox with public traffic disabled (secure access)
    result = sandbox.run_code("x =1; x")
    assert result.text == "1"
