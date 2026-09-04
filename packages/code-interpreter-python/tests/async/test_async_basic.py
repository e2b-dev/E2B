import pytest

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_basic(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code("x =1; x")
    assert result.text == "1"


@pytest.mark.skip_debug
async def test_secure_access(async_sandbox_factory):
    # Create sandbox with public traffic disabled (secure access)
    async_sandbox = await async_sandbox_factory(network={"allow_public_traffic": False})
    result = await async_sandbox.run_code("x =1; x")
    assert result.text == "1"
