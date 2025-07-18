import uuid
import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_connect(template):
    sbx = await AsyncSandbox.create(template, timeout=10)
    try:
        assert await sbx.is_running()

        sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)
        assert await sbx_connection.is_running()
    finally:
        await sbx.kill()


@pytest.mark.skip_debug()
async def test_connect_with_secure(template):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sbx = await AsyncSandbox.create(template, timeout=10, secure=True)
    assert await sbx.is_running()

    try:
        sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)

        await sbx_connection.files.make_dir(dir_name)
        files = await sbx_connection.files.list(dir_name)
        assert len(files) == 0
        assert await sbx_connection.is_running()
    finally:
        await sbx.kill()
