import uuid
import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_connect(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=10)

    assert await sbx.is_running()

    sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)
    assert await sbx_connection.is_running()


@pytest.mark.skip_debug()
async def test_connect_with_secure(async_sandbox_factory):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sbx = await async_sandbox_factory(timeout=10, secure=True)
    assert await sbx.is_running()

    sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)

    await sbx_connection.files.make_dir(dir_name)
    files = await sbx_connection.files.list(dir_name)
    assert len(files) == 0
    assert await sbx_connection.is_running()
