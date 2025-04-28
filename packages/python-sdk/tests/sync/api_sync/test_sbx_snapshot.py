import pytest
from e2b import Sandbox


@pytest.mark.skip_debug()
def test_pause_sandbox(sandbox: Sandbox):
    sandbox_id = sandbox.sandbox_id
    Sandbox.pause(sandbox_id)
    assert not sandbox.is_running()


@pytest.mark.skip_debug()
def test_resume_sandbox(sandbox: Sandbox):
    # pause
    sandbox_id = sandbox.sandbox_id
    Sandbox.pause(sandbox_id)
    assert not sandbox.is_running()

    # resume
    Sandbox.resume(sandbox_id)
    assert sandbox.is_running()
