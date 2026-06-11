import pytest

from e2b import Sandbox, TimeoutException


@pytest.mark.skip_debug()
def test_kill_sandbox_while_command_is_running(sandbox: Sandbox):
    cmd = sandbox.commands.run("sleep 60", background=True)

    sandbox.kill()

    with pytest.raises(TimeoutException) as exc_info:
        cmd.wait()

    # The health check confirms the sandbox is gone, so the error states it outright
    assert "sandbox was killed or reached its end of life" in str(exc_info.value)
