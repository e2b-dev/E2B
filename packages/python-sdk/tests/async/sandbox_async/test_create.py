import pytest

from time import sleep

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_start(template):
    sbx = await AsyncSandbox.create(template=template, timeout=5, auto_pause=True)
    try:
        assert await sbx.is_running()
        assert sbx._envd_version is not None
    finally:
        await sbx.kill()


@pytest.mark.skip_debug()
async def test_metadata(template):
    sbx = await AsyncSandbox.create(
        template=template, timeout=5, metadata={"test-key": "test-value"}, auto_pause=True
    )

    try:
        sbxs = await AsyncSandbox.list()

        for sbx_info in sbxs:
            if sbx.sandbox_id == sbx_info.sandbox_id:
                assert sbx_info.metadata is not None
                assert sbx_info.metadata["test-key"] == "test-value"
                break
        else:
            assert False, "Sandbox not found"
    finally:
        await sbx.kill()


@pytest.mark.skip_debug()
async def test_auto_pause(template):
    timeout = 1
    sbx = await AsyncSandbox.create(
        template=template, timeout=timeout, metadata={"test-key": "test-value"}, auto_pause=True
    )

    await sbx.files.write("test.txt", "test")

    # Wait for the sandbox to pause and create snapshot
    sleep(timeout + 5)

    sbx_resumed = await AsyncSandbox.connect(sbx.sandbox_id, timeout=5, auto_pause=True)
    try:
        assert await sbx_resumed.files.read("test.txt") == "test"
    finally:
        await sbx_resumed.kill()