import pytest

from e2b import AsyncSandbox, SandboxQuery, SandboxState


@pytest.mark.skip_debug()
async def test_kill(async_sandbox: AsyncSandbox, sandbox_test_id: str):
    await async_sandbox.kill()

    paginator = AsyncSandbox.list(
        query=SandboxQuery(
            state=[SandboxState.RUNNING], metadata={"sandbox_test_id": sandbox_test_id}
        )
    )
    sandboxes = await paginator.next_items()
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in sandboxes]
