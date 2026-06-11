import pytest

from e2b import AsyncSandbox, SandboxException


@pytest.mark.skip_debug()
async def test_kill_sandbox_while_command_is_running(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 60", background=True)

    await async_sandbox.kill()

    with pytest.raises(SandboxException) as exc_info:
        await cmd.wait()

    # The health check confirms the sandbox is gone, so the error states it outright
    assert "sandbox was killed or reached its end of life" in str(exc_info.value)
