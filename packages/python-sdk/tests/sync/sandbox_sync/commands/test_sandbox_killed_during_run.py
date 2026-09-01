import pytest

from e2b import Sandbox, TimeoutException


@pytest.mark.skip_debug()
def test_kill_sandbox_while_command_is_running(sandbox: Sandbox):
    cmd = sandbox.commands.run("sleep 60", background=True)

    sandbox.kill()

    with pytest.raises(TimeoutException) as exc_info:
        cmd.wait()

    # The proxy closes an interrupted Connect stream with an UNAVAILABLE status.
    assert "ended before the stream completed" in str(exc_info.value)
