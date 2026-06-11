import pytest

from e2b import Sandbox, CommandExitException
from e2b.sandbox.commands.command_handle import PtySize


def test_kill_pty(sandbox: Sandbox):
    terminal = sandbox.pty.create(PtySize(80, 24))

    assert sandbox.pty.kill(terminal.pid)

    # The PTY process should no longer be running.
    with pytest.raises(CommandExitException):
        sandbox.commands.run(f"kill -0 {terminal.pid}")


def test_kill_non_existing_pty(sandbox: Sandbox):
    non_existing_pid = 999999

    assert not sandbox.pty.kill(non_existing_pid)
