import pytest

from e2b import Sandbox, SandboxException


@pytest.mark.skip_debug()
def test_kill_sandbox_while_command_is_running(sandbox: Sandbox):
    cmd = sandbox.commands.run("sleep 60", background=True)

    sandbox.kill()

    with pytest.raises(SandboxException) as exc_info:
        cmd.wait()

    assert "sandbox was killed" in str(exc_info.value)
    assert "is_running" in str(exc_info.value)
