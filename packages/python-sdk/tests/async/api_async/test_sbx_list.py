import random
import string

import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_list_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = [sbx async for sbx in AsyncSandbox.list()]
    assert len(sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]


@pytest.mark.skip_debug()
async def test_list_sandboxes_with_filter(async_sandbox: AsyncSandbox):
    unique_id = "".join(random.choices(string.ascii_letters, k=5))
    sbx = await AsyncSandbox.create(metadata={"unique_id": unique_id})
    try:
        # There's an extra sandbox created by the test runner
        sandboxes_list = AsyncSandbox.list(filters={"unique_id": unique_id})
        sandboxes = [sbx async for sbx in sandboxes_list]
        assert len(sandboxes) == 1
        assert sandboxes[0].metadata["unique_id"] == unique_id
    finally:
        await sbx.kill()

@pytest.mark.skip_debug()
async def test_list_paused_sandboxes(async_sandbox: AsyncSandbox):
    paused_sandbox = await async_sandbox.pause()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"    
    sandboxes_list = AsyncSandbox.list(state=["paused"])
    sandboxes = [sbx async for sbx in sandboxes_list]
    assert len(sandboxes) > 0
    assert paused_sandbox_id in [sbx.sandbox_id for sbx in sandboxes]
