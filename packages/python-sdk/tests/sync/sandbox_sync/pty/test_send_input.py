from e2b import Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_send_input(sandbox: Sandbox):
    terminal = sandbox.pty.create(PtySize(cols=80, rows=24))
    sandbox.pty.send_input(terminal.pid, b"exit\n")
    result = terminal.wait()
    assert result.exit_code == 0


def test_handle_send_input(sandbox: Sandbox):
    output = []

    terminal = sandbox.pty.create(PtySize(cols=80, rows=24), envs={"ABC": "123"})

    # Send input directly through the handle instead of the PID-keyed module method.
    terminal.send_input(b"echo $ABC\n")
    terminal.send_input("exit\n")

    result = terminal.wait(on_pty=lambda x: output.append(x.decode("utf-8")))
    assert result.exit_code == 0
    assert "123" in "".join(output)


def test_send_stdin_deprecated_alias(sandbox: Sandbox):
    terminal = sandbox.pty.create(PtySize(cols=80, rows=24))
    sandbox.pty.send_stdin(terminal.pid, "exit\n")
    result = terminal.wait()
    assert result.exit_code == 0
