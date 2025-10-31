import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_start_secured(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=5, secure=True)

    assert await sbx.is_running()
    assert sbx._envd_version is not None
    assert sbx._envd_access_token is not None


@pytest.mark.skip_debug()
async def test_connect_to_secured(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=100, secure=True)

    assert await sbx.is_running()
    assert sbx._envd_version is not None
    assert sbx._envd_access_token is not None

    sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)
    assert await sbx_connection.is_running()
    assert sbx_connection._envd_version is not None
    assert sbx_connection._envd_access_token is not None
