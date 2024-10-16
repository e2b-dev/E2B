from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_resize(async_sandbox: AsyncSandbox):
    output = []

    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    terminal = await async_sandbox.pty.create(
        PtySize(cols=80, rows=24), on_data=lambda x: append_data(output, x)
    )

    await async_sandbox.pty.send_stdin(terminal.pid, b"tput cols\n")
    await async_sandbox.pty.send_stdin(terminal.pid, b"exit\n")
    await terminal.wait()
    assert terminal.exit_code == 0

    assert "80" in "".join(output)

    output = []

    terminal = await async_sandbox.pty.create(
        PtySize(cols=80, rows=24), on_data=lambda x: append_data(output, x)
    )

    await async_sandbox.pty.resize(terminal.pid, PtySize(cols=100, rows=24))
    await async_sandbox.pty.send_stdin(terminal.pid, b"tput cols\n")
    await async_sandbox.pty.send_stdin(terminal.pid, b"exit\n")

    await terminal.wait()
    assert terminal.exit_code == 0
    assert "100" in "".join(output)
