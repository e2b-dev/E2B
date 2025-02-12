import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_kill_existing_sandbox(async_sandbox: AsyncSandbox):
    assert await AsyncSandbox.kill(async_sandbox.sandbox_id) == True

    list = await AsyncSandbox.list()
    assert async_sandbox.sandbox_id not in [s.sandbox_id for s in list]


@pytest.mark.skip_debug()
async def test_kill_non_existing_sandbox():
    assert await AsyncSandbox.kill("non-existing-sandbox") == False


@pytest.mark.skip_debug()
async def test_kill_paused_sandbox(async_sandbox: AsyncSandbox):
    paused_sandbox = await async_sandbox.pause()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"

    assert await AsyncSandbox.kill(paused_sandbox_id) == True

    list = await AsyncSandbox.list()
    assert paused_sandbox_id not in [s.sandbox_id for s in list]
