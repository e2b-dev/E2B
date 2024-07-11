import pytest

from e2b import AsyncSandbox


@pytest.mark.asyncio
async def test_connect(template):
    sbx = await AsyncSandbox.create(template, timeout=10)
    try:
        assert await sbx.is_running()

        sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)
        assert await sbx_connection.is_running()
    finally:
        await sbx.kill()
