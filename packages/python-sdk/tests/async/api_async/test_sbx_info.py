import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_get_info(async_sandbox: AsyncSandbox):
    info = await AsyncSandbox.get_info(async_sandbox.sandbox_id)
    assert info.sandbox_id == async_sandbox.sandbox_id
