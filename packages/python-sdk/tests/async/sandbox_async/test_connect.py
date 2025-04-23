import pytest

from e2b import AsyncSandbox


async def test_connect(template):
    sbx = await AsyncSandbox.create(template=template, timeout=10, auto_pause=True)
    try:
        assert await sbx.is_running()

        sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id, auto_pause=True)
        assert await sbx_connection.is_running()
    finally:
        await sbx.kill()
