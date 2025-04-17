import pytest

from time import sleep

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_snapshot(template):
    sbx = await AsyncSandbox.create(template=template, timeout=5, auto_pause=True)
    try:
        assert await sbx.is_running()

        sandbox_id = await sbx.pause()
        assert not await sbx.is_running()

        await sbx.connect(sandbox_id, auto_pause=True)
        assert await sbx.is_running()
    finally:
        await sbx.kill()


@pytest.mark.skip_debug()
async def test_resume_with_auto_pause(template):
    sbx = await AsyncSandbox.create(template=template, timeout=5, auto_pause=True)
    await sbx.pause()

    timeout = 1
    sbx_resumed = await AsyncSandbox.connect(
        sbx.sandbox_id, timeout=timeout, auto_pause=True
    )
    await sbx_resumed.files.write("test.txt", "test")

    # Wait for the sandbox to pause and create snapshot
    sleep(timeout + 5)

    sbx_resumed2 = await AsyncSandbox.connect(
        sbx.sandbox_id, timeout=timeout, auto_pause=True
    )

    try:
        assert await sbx_resumed2.files.read("test.txt") == "test"
    finally:
        await sbx_resumed2.kill()
