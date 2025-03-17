import pytest

from time import sleep

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_snapshot(template):
    sbx = Sandbox(template=template, timeout=5, auto_pause=True)
    try:
        assert sbx.is_running()

        sandbox_id = sbx.pause()
        assert not sbx.is_running()

        sbx.connect(sandbox_id, auto_pause=True)
        assert sbx.is_running()
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_resume_with_auto_pause(template):
    sbx = Sandbox(template=template, timeout=5, auto_pause=True)
    sbx.pause()

    timeout = 1
    sbx_resumed = Sandbox.connect(sbx.sandbox_id, timeout=timeout, auto_pause=True)
    sbx_resumed.files.write('test.txt', 'test')

    # Wait for the sandbox to pause and create snapshot
    sleep(timeout + 5)

    sbx_resumed2 = Sandbox.connect(sbx.sandbox_id, timeout=timeout, auto_pause=True)

    try:
        assert sbx_resumed2.files.read('test.txt') == 'test'
    finally:
        sbx_resumed2.kill()