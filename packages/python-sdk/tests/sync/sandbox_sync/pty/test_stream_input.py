from e2b import Sandbox
from e2b.sandbox.commands.command_handle import PtySize


def test_stream_input_to_pty(sandbox: Sandbox):
    terminal = sandbox.pty.create(PtySize(cols=80, rows=24))
    stream = sandbox.pty.stream_input(terminal.pid, timeout=0)

    for char in "echo hello-stream\nexit\n":
        stream.send(char)
    stream.close()

    output = []
    terminal.wait(on_pty=lambda data: output.append(data.decode("utf-8")))
    assert any(line.strip() == "hello-stream" for line in "".join(output).splitlines())
