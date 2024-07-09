import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
@pytest.mark.anyio
async def test_list_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list()
    assert len(sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]
