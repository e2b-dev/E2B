import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_pause_sandbox(async_sandbox: AsyncSandbox):
    await AsyncSandbox.beta_pause(async_sandbox.sandbox_id)
    assert not await async_sandbox.is_running()


@pytest.mark.skip_debug()
async def test_resume_sandbox(async_sandbox: AsyncSandbox):
    # pause
    await AsyncSandbox.beta_pause(async_sandbox.sandbox_id)
    assert not await async_sandbox.is_running()

    # resume
    await AsyncSandbox.connect(async_sandbox.sandbox_id)
    assert await async_sandbox.is_running()
