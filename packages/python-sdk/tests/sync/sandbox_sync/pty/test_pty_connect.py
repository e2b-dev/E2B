import time

import pytest

from e2b.sandbox.commands.command_handle import PtySize

@pytest.mark.skip_debug()
def test_connect_to_pty(sandbox_factory):
    sandbox = sandbox_factory(timeout=100)
    output = []

    def append_data(data: list, x: bytes):
        data.append(x.decode("utf-8"))

    terminal = sandbox.pty.create(PtySize(80, 24), envs={"FOO": "bar"})

    sandbox.pty.send_stdin(terminal.pid, b"echo $FOO\n")

    terminal.disconnect()

    # Now connect again, with a new on_pty handler
    reconnect_handle = sandbox.pty.connect(terminal.pid)

    sandbox.pty.send_stdin(terminal.pid, b"echo $FOO\nexit\n")

    result = reconnect_handle.wait(on_pty=lambda x: append_data(output, x))

    assert terminal.pid == reconnect_handle.pid
    assert result.exit_code == 0

    assert "bar" in "".join(output)    
