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


@pytest.mark.skip_debug()
async def test_connect_to_paused_sandbox_resumes(async_sandbox):
    await async_sandbox.pause()
    assert not await async_sandbox.is_running()

    resumed = await AsyncSandbox.connect(async_sandbox.sandbox_id)
    assert await resumed.is_running()


@pytest.mark.skip_debug()
async def test_resume_does_not_shorten_timeout_on_running_sandbox(
    async_sandbox_factory,
):
    # Create sandbox with a 300 second timeout
    sbx = await async_sandbox_factory(timeout=300)
    assert await sbx.is_running()

    # Get initial info to check end_at
    info_before = await AsyncSandbox.get_info(sbx.sandbox_id)

    # Resume with a shorter timeout (10 seconds)
    await AsyncSandbox.resume(sbx.sandbox_id, timeout=10)

    # Get info after connection
    info_after = await AsyncSandbox.get_info(sbx.sandbox_id)

    # The end_at time should not have been shortened. It should be the same
    assert info_after.end_at == info_before.end_at, (
        f"Timeout was changed: before={info_before.end_at}, after={info_after.end_at}"
    )


@pytest.mark.skip_debug()
async def test_resume_extends_timeout_on_running_sandbox(async_sandbox):
    # Create sandbox with a short timeout
    assert await async_sandbox.is_running()

    # Get initial info to check end_at
    info_before = await async_sandbox.get_info()

    # Resume with a longer timeout
    await AsyncSandbox.resume(async_sandbox.sandbox_id, timeout=600)

    # Get info after connection
    info_after = await AsyncSandbox.get_info(async_sandbox.sandbox_id)

    # The end_at time should have been extended
    assert info_after.end_at > info_before.end_at, (
        f"Timeout was not extended: before={info_before.end_at}, after={info_after.end_at}"
    )
