from e2b import Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_resize(sandbox: Sandbox):
    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    terminal = sandbox.pty.create(PtySize(cols=80, rows=24))

    sandbox.pty.send_stdin(terminal.pid, b"tput cols\nexit\n")

    output = []
    result = terminal.wait(on_pty=lambda x: append_data(output, x))
    assert result.exit_code == 0

    assert "80" in "".join(output)

    terminal = sandbox.pty.create(PtySize(cols=80, rows=24))

    sandbox.pty.resize(terminal.pid, PtySize(cols=100, rows=24))
    sandbox.pty.send_stdin(terminal.pid, b"tput cols\nexit\n")

    output = []
    result = terminal.wait(on_pty=lambda x: append_data(output, x))
    assert result.exit_code == 0

    assert "100" in "".join(output)
