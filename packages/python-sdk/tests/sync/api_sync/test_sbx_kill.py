import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_kill_existing_sandbox(sandbox: Sandbox):
    assert Sandbox.kill(sandbox.sandbox_id)

    list = Sandbox.list()
    assert sandbox.sandbox_id not in [s.sandbox_id for s in list]


@pytest.mark.skip_debug()
def test_kill_non_existing_sandbox():
    assert not Sandbox.kill("non-existing-sandbox")
