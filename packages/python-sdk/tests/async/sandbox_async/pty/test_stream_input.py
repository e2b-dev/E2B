from e2b import AsyncSandbox
from e2b.sandbox.commands.command_handle import PtySize


async def test_stream_input_to_pty(async_sandbox: AsyncSandbox):
    output = []
    terminal = await async_sandbox.pty.create(
        PtySize(cols=80, rows=24),
        on_data=lambda data: output.append(data.decode("utf-8")),
    )
    stream = async_sandbox.pty.stream_input(terminal.pid, timeout=0)

    for char in "echo hello-stream\nexit\n":
        await stream.send(char)
    await stream.close()
    await terminal.wait()

    assert any(line.strip() == "hello-stream" for line in "".join(output).splitlines())
