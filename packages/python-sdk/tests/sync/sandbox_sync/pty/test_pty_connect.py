from e2b import Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_connect_to_pty(sandbox: Sandbox):
    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    terminal = sandbox.pty.create(PtySize(80, 24), envs={"ABC": "123"}, cwd="/")
    pid = terminal.pid

    # Connect to the running PTY
    connected_terminal = sandbox.pty.connect(pid)
    assert connected_terminal.pid == pid

    sandbox.pty.send_stdin(pid, b"echo $ABC\nexit\n")

    output = []
    result = connected_terminal.wait(on_pty=lambda x: append_data(output, x))
    assert result.exit_code == 0

    assert "123" in "\n".join(output)
