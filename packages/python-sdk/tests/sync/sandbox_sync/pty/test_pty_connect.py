import threading
import time

from e2b import Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_connect_to_pty(sandbox: Sandbox):
    output1 = []
    output2 = []

    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    # First, create a terminal and collect output in a thread
    # (Thread is needed because sync API doesn't support on_data in create(),
    # and iterating blocks, so we need a separate thread to collect output1)
    terminal = sandbox.pty.create(PtySize(80, 24), envs={"FOO": "bar"})

    def collect_output1():
        for _, _, pty in terminal:
            if pty is not None:
                append_data(output1, pty)

    thread = threading.Thread(target=collect_output1, daemon=True)
    thread.start()

    sandbox.pty.send_stdin(terminal.pid, b"echo $FOO\n")

    # Give time for the command output in the first connection
    time.sleep(0.3)

    terminal.disconnect()

    # Now connect again, with a new on_pty handler
    reconnect_handle = sandbox.pty.connect(terminal.pid)

    sandbox.pty.send_stdin(terminal.pid, b"echo $FOO\nexit\n")

    result = reconnect_handle.wait(on_pty=lambda x: append_data(output2, x))

    assert terminal.pid == reconnect_handle.pid
    assert result.exit_code == 0

    assert "bar" in "".join(output1)
    assert "bar" in "".join(output2)
