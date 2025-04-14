import pytest

from e2b import Sandbox, SandboxListQuery

@pytest.mark.skip_debug()
def test_kill_existing_sandbox(sandbox: Sandbox, sandbox_type: str):
    assert Sandbox.kill(sandbox.sandbox_id) == True

    list = Sandbox.list(query=SandboxListQuery(state=["running"], metadata={"sandbox_type": sandbox_type}))
    assert sandbox.sandbox_id not in [s.sandbox_id for s in list.sandboxes]


@pytest.mark.skip_debug()
def test_kill_non_existing_sandbox():
    assert Sandbox.kill("non-existing-sandbox") == False
