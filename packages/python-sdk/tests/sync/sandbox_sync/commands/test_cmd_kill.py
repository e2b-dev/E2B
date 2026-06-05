import pytest

from e2b import Sandbox, CommandExitException


def test_kill_process(sandbox: Sandbox):
    cmd = sandbox.commands.run("sleep 10", background=True)
    pid = cmd.pid

    assert sandbox.commands.kill(pid)

    with pytest.raises(CommandExitException):
        sandbox.commands.run(f"kill -0 {pid}")


def test_kill_process_tree(sandbox: Sandbox):
    # Regression test for https://github.com/e2b-dev/E2B/issues/1034
    #
    # envd's SendSignal RPC only signals the single process it manages, so child
    # processes the command spawned used to keep running after kill(). Killing the
    # command must terminate its whole process tree.
    cmd = sandbox.commands.run(
        "sleep 120 & sleep 120 & wait",
        background=True,
    )

    # Capture the child PIDs while the leader is still alive.
    children = sandbox.commands.run(f"pgrep -P {cmd.pid}")
    child_pids = children.stdout.split()
    assert len(child_pids) == 2

    assert cmd.kill()

    # The leader and every child must be gone.
    with pytest.raises(CommandExitException):
        sandbox.commands.run(f"kill -0 {cmd.pid}")
    alive = sandbox.commands.run(
        f"for p in {' '.join(child_pids)}; do kill -0 $p 2>/dev/null && echo $p; done; true"
    )
    assert alive.stdout.strip() == ""


def test_kill_non_existing_process(sandbox):
    non_existing_pid = 999999

    assert not sandbox.commands.kill(non_existing_pid)
