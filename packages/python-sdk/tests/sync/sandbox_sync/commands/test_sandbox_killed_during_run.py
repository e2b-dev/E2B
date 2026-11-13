import pytest

from e2b import Sandbox, TimeoutException


@pytest.mark.skip_debug()
def test_kill_sandbox_while_command_is_running(sandbox: Sandbox):
    cmd = sandbox.commands.run("sleep 60", background=True)

    sandbox.kill()

    with pytest.raises(TimeoutException) as exc_info:
        cmd.wait()

    # The proxy emits UNAVAILABLE at a frame boundary; a partial frame remains a
    # transport failure and is disambiguated by the SDK's sandbox health check.
    message = str(exc_info.value)
    assert (
        "ended before the stream completed" in message
        or "sandbox was killed or reached its end of life" in message
    )
