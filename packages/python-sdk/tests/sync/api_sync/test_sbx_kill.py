import pytest

from e2b import Sandbox, SandboxQuery, SandboxState


@pytest.mark.skip_debug()
def test_kill_existing_sandbox(sandbox: Sandbox, sandbox_test_id: str):
    assert Sandbox.kill(sandbox.sandbox_id)

    paginator = Sandbox.list(
        query=SandboxQuery(
            state=[SandboxState.RUNNING], metadata={"sandbox_test_id": sandbox_test_id}
        )
    )
    sandboxes = paginator.next_items()
    assert sandbox.sandbox_id not in [s.sandbox_id for s in sandboxes]


@pytest.mark.skip_debug()
def test_kill_non_existing_sandbox():
    assert not Sandbox.kill("non-existing-sandbox")
