import pytest

from e2b import AsyncSandbox, TimeoutException


@pytest.mark.skip_debug()
async def test_kill_sandbox_while_command_is_running(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 60", background=True)

    await async_sandbox.kill()

    with pytest.raises(TimeoutException) as exc_info:
        await cmd.wait()

    # The proxy closes an interrupted Connect stream with an UNAVAILABLE status.
    assert "ended before the stream completed" in str(exc_info.value)
