import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_kill_existing_sandbox(sandbox: Sandbox):
    assert Sandbox.kill(sandbox.sandbox_id) == True

    list = Sandbox.list()
    assert sandbox.sandbox_id not in [s.sandbox_id for s in list]


@pytest.mark.skip_debug()
def test_kill_non_existing_sandbox():
    assert Sandbox.kill("non-existing-sandbox") == False


@pytest.mark.skip_debug()
def test_kill_paused_sandbox(sandbox: Sandbox):
    paused_sandbox = sandbox.pause()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"

    assert Sandbox.kill(paused_sandbox) == True

    list = Sandbox.list()
    assert paused_sandbox_id not in [s.sandbox_id for s in list]
