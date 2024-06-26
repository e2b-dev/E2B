import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_kill_existing_sandbox(sandbox: Sandbox):
    Sandbox.kill(sandbox.sandbox_id)


@pytest.mark.skip_debug()
def test_kill_non_existing_sandbox():
    with pytest.raises(RuntimeError):
        Sandbox.kill("non-existing-sandbox")
