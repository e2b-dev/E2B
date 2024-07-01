import pytest

from e2b import Sandbox, SandboxException


@pytest.mark.skip_debug()
def test_kill_existing_sandbox(sandbox: Sandbox):
    Sandbox.kill(sandbox.sandbox_id)


@pytest.mark.skip_debug()
def test_kill_non_existing_sandbox():
    with pytest.raises(SandboxException):
        Sandbox.kill("non-existing-sandbox")
