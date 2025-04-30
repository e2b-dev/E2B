import pytest
from e2b import Sandbox


@pytest.mark.skip_debug()
def test_pause_sandbox(sandbox: Sandbox):
    Sandbox.pause(sandbox.sandbox_id)
    assert not sandbox.is_running()


@pytest.mark.skip_debug()
def test_resume_sandbox(sandbox: Sandbox):
    # pause
    Sandbox.pause(sandbox.sandbox_id)
    assert not sandbox.is_running()

    # resume
    Sandbox.resume(sandbox.sandbox_id)
    assert sandbox.is_running()
