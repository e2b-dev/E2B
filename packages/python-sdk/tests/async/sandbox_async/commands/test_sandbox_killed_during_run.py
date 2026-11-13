import pytest

from e2b import AsyncSandbox, TimeoutException


@pytest.mark.skip_debug()
async def test_kill_sandbox_while_command_is_running(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 60", background=True)

    await async_sandbox.kill()

    with pytest.raises(TimeoutException) as exc_info:
        await cmd.wait()

    # The proxy emits UNAVAILABLE at a frame boundary; a partial frame remains a
    # transport failure and is disambiguated by the SDK's sandbox health check.
    message = str(exc_info.value)
    assert (
        "ended before the stream completed" in message
        or "sandbox was killed or reached its end of life" in message
    )
