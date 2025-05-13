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


async def test_connect_to_secured(template):
    sbx = await AsyncSandbox.create(template, timeout=100, secure=True)
    try:
        assert await sbx.is_running()
        assert sbx._envd_version is not None
        assert sbx._envd_access_token is not None

        sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)
        assert await sbx_connection.is_running()
        assert sbx_connection._envd_version is not None
        assert sbx_connection._envd_access_token is not None
    finally:
        await sbx.kill()
