import pytest
from e2b import Sandbox


@pytest.mark.skip_debug()
def test_pause_sandbox(sandbox: Sandbox):
    Sandbox.beta_pause(sandbox.sandbox_id)
    assert not sandbox.is_running()


@pytest.mark.skip_debug()
def test_resume_sandbox(sandbox: Sandbox):
    # pause
    Sandbox.beta_pause(sandbox.sandbox_id)
    assert not sandbox.is_running()

    # resume
    Sandbox.connect(sandbox.sandbox_id)
    assert sandbox.is_running()
