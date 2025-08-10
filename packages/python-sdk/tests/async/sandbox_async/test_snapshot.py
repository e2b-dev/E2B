import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_snapshot(template):
    sbx = await AsyncSandbox.create(template, timeout=5)
    try:
        assert await sbx.is_running()

        await sbx.beta.pause()
        assert not await sbx.is_running()

        await sbx.beta.resume()
        assert await sbx.is_running()
    finally:
        await sbx.kill()
