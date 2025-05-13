import pytest

from e2b import AsyncSandbox


async def test_start_secured(template):
    sbx = await AsyncSandbox.create(template, timeout=5, secure=True)
    try:
        assert await sbx.is_running()
        assert sbx._envd_version is not None
        assert sbx._envd_access_token is not None
    finally:
        await sbx.kill()
