import pytest

from e2b import AsyncSandbox, SandboxListQuery


@pytest.mark.skip_debug()
async def test_kill(async_sandbox: AsyncSandbox, sandbox_type: str):
    await async_sandbox.kill()

    list = await AsyncSandbox.list(query=SandboxListQuery(state=["running"], metadata={"sandbox_type": sandbox_type}))
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in list.sandboxes]
