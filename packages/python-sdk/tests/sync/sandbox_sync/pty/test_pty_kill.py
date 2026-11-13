from e2b import Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_kill_pty(sandbox: Sandbox):
    terminal = sandbox.pty.create(PtySize(80, 24))

    assert sandbox.pty.kill(terminal.pid)

    # PTY teardown is asynchronous, so wait for the process to disappear.
    sandbox.commands.run(
        f"for i in $(seq 1 50); do kill -0 {terminal.pid} 2>/dev/null || exit 0; "
        "sleep 0.1; done; exit 1"
    )


def test_kill_non_existing_pty(sandbox: Sandbox):
    non_existing_pid = 999999

    assert not sandbox.pty.kill(non_existing_pid)
