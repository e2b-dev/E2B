import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_kill(async_sandbox: AsyncSandbox):
    await async_sandbox.kill()

    list = await AsyncSandbox.list()
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in list]


@pytest.mark.skip_debug()
async def test_kill_paused_sandbox(async_sandbox: AsyncSandbox):
    paused_sandbox = await async_sandbox.pause()
    assert await AsyncSandbox.kill(paused_sandbox) == True

    list = await AsyncSandbox.list()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"

    assert paused_sandbox_id not in [s.sandbox_id for s in list]
