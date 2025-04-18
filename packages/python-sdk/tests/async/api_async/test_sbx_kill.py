import pytest

from e2b import AsyncSandbox, SandboxListQuery


@pytest.mark.skip_debug()
async def test_kill_existing_sandbox(async_sandbox: AsyncSandbox, sandbox_type: str):
    assert await AsyncSandbox.kill(async_sandbox.sandbox_id) == True

    paginator = AsyncSandbox.list(
        query=SandboxListQuery(
            state=["running"], metadata={"sandbox_type": sandbox_type}
        )
    )
    sandboxes = await paginator.next_items()
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in sandboxes]


@pytest.mark.skip_debug()
async def test_kill_non_existing_sandbox():
    assert await AsyncSandbox.kill("non-existing-sandbox") == False
