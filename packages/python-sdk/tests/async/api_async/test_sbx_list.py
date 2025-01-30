from e2b.api.client.models.get_sandboxes_state import GetSandboxesState
import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_list_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list()
    assert len(sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]


@pytest.mark.skip_debug()
async def test_list_paused_sandboxes(async_sandbox: AsyncSandbox):
    await async_sandbox.pause()
    sandboxes = await AsyncSandbox.list(state=GetSandboxesState.PAUSED)
    assert len(sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]
