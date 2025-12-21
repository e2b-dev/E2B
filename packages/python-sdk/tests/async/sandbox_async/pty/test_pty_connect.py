from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_connect_to_pty(async_sandbox: AsyncSandbox):
    output = []

    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    terminal = await async_sandbox.pty.create(
        PtySize(80, 24), on_data=lambda x: append_data(output, x), envs={"ABC": "123"}
    )
    pid = terminal.pid

    # Connect to the running PTY
    connected_terminal = await async_sandbox.pty.connect(
        pid, on_data=lambda x: append_data(output, x)
    )
    assert connected_terminal.pid == pid

    await async_sandbox.pty.send_stdin(pid, b"echo $ABC\n")
    await async_sandbox.pty.send_stdin(pid, b"exit\n")

    await connected_terminal.wait()
    assert connected_terminal.exit_code == 0

    assert "123" in "".join(output)
