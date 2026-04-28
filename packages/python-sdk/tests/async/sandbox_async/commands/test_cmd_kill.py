import asyncio

import pytest

from e2b import AsyncSandbox, CommandExitException


async def test_kill_process(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("sleep 10", background=True)
    pid = cmd.pid

    await async_sandbox.commands.kill(pid)

    with pytest.raises(CommandExitException):
        await async_sandbox.commands.run(f"kill -0 {pid}")


async def test_kill_non_existing_process(async_sandbox: AsyncSandbox):
    non_existing_pid = 999999

    assert not await async_sandbox.commands.kill(non_existing_pid)


async def test_kill_via_handle(async_sandbox: AsyncSandbox):
    handle = await async_sandbox.commands.run("sleep 60", background=True)
    killed = await handle.kill()
    assert killed is True
    with pytest.raises(CommandExitException):
        await async_sandbox.commands.run(f"kill -0 {handle.pid}")


async def test_kill_handle_wait_raises(async_sandbox: AsyncSandbox):
    handle = await async_sandbox.commands.run("sleep 60", background=True)
    await handle.kill()
    # Before the fix: this blocks forever (or until the 5s timeout fires as TimeoutError).
    # After the fix: raises CommandExitException promptly because the process was killed.
    with pytest.raises(CommandExitException):
        await asyncio.wait_for(handle.wait(), timeout=5.0)
