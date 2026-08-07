from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_send_input(async_sandbox: AsyncSandbox):
    terminal = await async_sandbox.pty.create(
        PtySize(cols=80, rows=24), on_data=lambda x: print(x)
    )
    await async_sandbox.pty.send_stdin(terminal.pid, b"exit\n")
    await terminal.wait()
    assert terminal.exit_code == 0


async def test_handle_send_stdin(async_sandbox: AsyncSandbox):
    output = []

    terminal = await async_sandbox.pty.create(
        PtySize(cols=80, rows=24),
        on_data=lambda x: output.append(x.decode("utf-8")),
        envs={"ABC": "123"},
    )

    # Send input directly through the handle instead of the PID-keyed module method.
    await terminal.send_stdin(b"echo $ABC\n")
    await terminal.send_stdin("exit\n")

    await terminal.wait()
    assert terminal.exit_code == 0
    assert "123" in "".join(output)
