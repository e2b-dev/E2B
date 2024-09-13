from e2b import AsyncSandbox
from e2b.sandbox.process.process_handle import PtySize


async def test_send_input(async_sandbox: AsyncSandbox):
    terminal = await async_sandbox.pty.create(PtySize(cols=80, rows=24))
    await async_sandbox.pty.send_stdin(terminal.pid, b"exit\n")
    await terminal.wait()
    assert terminal.exit_code == 0
