import pytest

from e2b_code_interpreter.code_interpreter_sync import Sandbox


@pytest.mark.skip_debug
def test_reconnect(sandbox: Sandbox):
    sandbox_id = sandbox.sandbox_id

    sandbox2 = Sandbox.connect(sandbox_id)
    result = sandbox2.run_code("x =1; x")
    assert result.text == "1"
