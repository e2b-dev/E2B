from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_kill_pty(async_sandbox: AsyncSandbox):
    terminal = await async_sandbox.pty.create(PtySize(80, 24), on_data=lambda _: None)

    assert await async_sandbox.pty.kill(terminal.pid)

    # PTY teardown is asynchronous, so wait for the process to disappear.
    await async_sandbox.commands.run(
        f"for i in $(seq 1 50); do kill -0 {terminal.pid} 2>/dev/null || exit 0; "
        "sleep 0.1; done; exit 1"
    )


async def test_kill_non_existing_pty(async_sandbox: AsyncSandbox):
    non_existing_pid = 999999

    assert not await async_sandbox.pty.kill(non_existing_pid)
