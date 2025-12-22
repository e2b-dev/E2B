import asyncio

from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_connect_to_pty(async_sandbox: AsyncSandbox):
    output1 = []
    output2 = []

    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    # First, create a terminal and disconnect the on_data handler
    terminal = await async_sandbox.pty.create(
        PtySize(80, 24),
        on_data=lambda x: append_data(output1, x),
        envs={"FOO": "bar"},
    )

    await async_sandbox.pty.send_stdin(terminal.pid, b"echo $FOO\n")

    # Give time for the command output in the first connection
    await asyncio.sleep(0.3)

    await terminal.disconnect()

    # Now connect again, with a new on_data handler
    reconnect_handle = await async_sandbox.pty.connect(
        terminal.pid, on_data=lambda x: append_data(output2, x)
    )

    await async_sandbox.pty.send_stdin(terminal.pid, b"echo $FOO\nexit\n")

    await reconnect_handle.wait()

    assert terminal.pid == reconnect_handle.pid
    assert reconnect_handle.exit_code == 0

    assert "bar" in "".join(output1)
    assert "bar" in "".join(output2)
