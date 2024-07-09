import pytest

from e2b import AsyncSandbox, ProcessExitException


@pytest.mark.asyncio
async def test_kill_process(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 10", background=True)
    pid = cmd.pid

    await async_sandbox.commands.kill(pid)

    with pytest.raises(ProcessExitException):
        await async_sandbox.commands.run(f"kill -0 {pid}")


@pytest.mark.asyncio
async def test_kill_non_existing_process(async_sandbox: AsyncSandbox):
    non_existing_pid = 999999

    assert await async_sandbox.commands.kill(non_existing_pid) == False
