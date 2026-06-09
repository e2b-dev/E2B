import pytest

from e2b import AsyncSandbox, CommandExitException
from e2b.sandbox.commands.command_handle import PtySize


async def test_kill_pty(async_sandbox: AsyncSandbox):
    terminal = await async_sandbox.pty.create(PtySize(80, 24), on_data=lambda _: None)

    assert await async_sandbox.pty.kill(terminal.pid)

    # The PTY process should no longer be running.
    with pytest.raises(CommandExitException):
        await async_sandbox.commands.run(f"kill -0 {terminal.pid}")


async def test_kill_non_existing_pty(async_sandbox: AsyncSandbox):
    non_existing_pid = 999999

    assert not await async_sandbox.pty.kill(non_existing_pid)
