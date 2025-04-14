import pytest

from e2b import AsyncSandbox, SandboxListQuery


@pytest.mark.skip_debug()
async def test_kill_existing_sandbox(async_sandbox: AsyncSandbox, sandbox_type: str):
    assert await AsyncSandbox.kill(async_sandbox.sandbox_id) == True

    list = await AsyncSandbox.list(query=SandboxListQuery(state=["running"], metadata={"sandbox_type": sandbox_type}))
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in list.sandboxes]


@pytest.mark.skip_debug()
async def test_kill_non_existing_sandbox():
    assert await AsyncSandbox.kill("non-existing-sandbox") == False
