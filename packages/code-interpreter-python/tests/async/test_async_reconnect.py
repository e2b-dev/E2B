import pytest

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


@pytest.mark.skip_debug
async def test_reconnect(async_sandbox: AsyncSandbox):
    sandbox_id = async_sandbox.sandbox_id

    sandbox2 = await AsyncSandbox.connect(sandbox_id)
    result = await sandbox2.run_code("x =1; x")
    assert result.text == "1"
