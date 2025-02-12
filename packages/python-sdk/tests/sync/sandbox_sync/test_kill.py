import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_kill(sandbox: Sandbox):
    sandbox.kill()

    list = Sandbox.list()
    assert sandbox.sandbox_id not in [s.sandbox_id for s in list]


@pytest.mark.skip_debug()
def test_kill_paused_sandbox(sandbox: Sandbox):
    paused_sandbox = sandbox.pause()
    Sandbox.kill(paused_sandbox)

    list = Sandbox.list()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"

    assert paused_sandbox_id not in [s.sandbox_id for s in list]
