import pytest

from e2b import Sandbox, SandboxListQuery


@pytest.mark.skip_debug()
def test_kill(sandbox: Sandbox, sandbox_type: str):
    sandbox.kill()

    list = Sandbox.list(query=SandboxListQuery(state=["running"], metadata={"sandbox_type": sandbox_type}))
    assert sandbox.sandbox_id not in [s.sandbox_id for s in list.sandboxes]
