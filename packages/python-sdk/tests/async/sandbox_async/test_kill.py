import pytest

from e2b import AsyncSandbox, SandboxQuery, SandboxState


@pytest.mark.skip_debug()
async def test_kill(async_sandbox: AsyncSandbox, sandbox_type: str):
    await async_sandbox.kill()

    paginator = AsyncSandbox.list(
        query=SandboxQuery(
            state=[SandboxState.RUNNING], metadata={"sandbox_type": sandbox_type}
        )
    )
    sandboxes = await paginator.next_items()
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in sandboxes]
