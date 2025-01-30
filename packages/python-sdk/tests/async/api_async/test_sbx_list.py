import random
import string

from e2b.api.client.models.get_sandboxes_state import GetSandboxesState
import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_list_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list()
    assert len(sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]


@pytest.mark.skip_debug()
async def test_list_sandboxes_with_filter(async_sandbox: AsyncSandbox):
    unique_id = "".join(random.choices(string.ascii_letters, k=5))
    sbx = await AsyncSandbox.create(metadata={"unique_id": unique_id})
    try:
        # There's an extra sandbox created by the test runner
        sandboxes = await AsyncSandbox.list(filters={"unique_id": unique_id})
        assert len(sandboxes) == 1
        assert sandboxes[0].metadata["unique_id"] == unique_id
    finally:
        await sbx.kill()

@pytest.mark.skip_debug()
async def test_list_paused_sandboxes(async_sandbox: AsyncSandbox):
    await async_sandbox.pause()
    sandboxes = await AsyncSandbox.list(state=GetSandboxesState.PAUSED)
    assert len(sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]
