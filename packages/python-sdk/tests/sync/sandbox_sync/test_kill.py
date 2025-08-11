import pytest

from e2b import Sandbox, SandboxQuery, SandboxState


@pytest.mark.skip_debug()
def test_kill(sandbox: Sandbox, sandbox_test_id: str):
    sandbox.kill()

    paginator = Sandbox.list(
        query=SandboxQuery(
            state=[SandboxState.RUNNING], metadata={"sandbox_test_id": sandbox_test_id}
        )
    )
    sandboxes = paginator.next_items()
    assert sandbox.sandbox_id not in [s.sandbox_id for s in sandboxes]
