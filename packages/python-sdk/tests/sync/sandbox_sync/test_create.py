import pytest

from time import sleep

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_start(template):
    sbx = Sandbox(template=template, timeout=5, auto_pause=True)
    try:
        assert sbx.is_running()
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_metadata(template):
    sbx = Sandbox(template=template, timeout=5, metadata={"test-key": "test-value"}, auto_pause=True)

    try:
        sbxs = Sandbox.list()

        for sbx_info in sbxs:
            if sbx.sandbox_id == sbx_info.sandbox_id:
                assert sbx_info.metadata is not None
                assert sbx_info.metadata["test-key"] == "test-value"
                break
        else:
            assert False, "Sandbox not found"
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_auto_pause(template):
    timeout = 1
    sbx = Sandbox(
        template=template, timeout=timeout, metadata={"test-key": "test-value"}, auto_pause=True
    )

    sbx.files.write("test.txt", "test")

    # Wait for the sandbox to pause and create snapshot
    sleep(timeout + 5)

    sbx_resumed = Sandbox.connect(sbx.sandbox_id, timeout=5, auto_pause=True)
    try:
        assert sbx_resumed.files.read("test.txt") == "test"
    finally:
        sbx_resumed.pause()