from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_pty_create(async_sandbox: AsyncSandbox):
    output = []

    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    terminal = await async_sandbox.pty.create(
        PtySize(80, 24), on_data=lambda x: append_data(output, x), envs={"ABC": "123"}
    )

    await async_sandbox.pty.send_stdin(terminal.pid, b"echo $ABC\n")
    await async_sandbox.pty.send_stdin(terminal.pid, b"exit\n")

    await terminal.wait()
    assert terminal.exit_code == 0

    assert "123" in "".join(output)
