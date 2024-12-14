import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_snapshot(template):
    sbx = await AsyncSandbox.create(template, timeout=5)
    try:
        assert await sbx.is_running()

        sandbox_id = await sbx.pause()
        assert not await sbx.is_running()

        await sbx.resume(sandbox_id)
        assert await sbx.is_running()
    finally:
        await sbx.kill()
