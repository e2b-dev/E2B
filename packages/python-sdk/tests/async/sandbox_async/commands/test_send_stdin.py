import asyncio

from e2b import AsyncSandbox


async def test_send_stdin_to_process(async_sandbox: AsyncSandbox):
    ev = asyncio.Event()

    def handle_event(stdout: str):
        ev.set()

    cmd = await async_sandbox.commands.run(
        "cat", background=True, on_stdout=handle_event, stdin=True
    )
    await async_sandbox.commands.send_stdin(cmd.pid, "Hello, World!")

    await ev.wait()

    assert cmd.stdout == "Hello, World!"


async def test_send_stdin_via_command_handle(async_sandbox: AsyncSandbox):
    ev = asyncio.Event()

    def handle_event(stdout: str):
        ev.set()

    cmd = await async_sandbox.commands.run(
        "cat", background=True, on_stdout=handle_event, stdin=True
    )
    await cmd.send_stdin("Hello, World!")

    await ev.wait()

    assert cmd.stdout == "Hello, World!"


async def test_close_stdin_via_command_handle(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("cat", background=True, stdin=True)
    await cmd.send_stdin("Hello, World!")
    await cmd.close_stdin()

    # `cat` exits once stdin is closed (EOF).
    result = await cmd.wait()
    assert result.exit_code == 0
    assert result.stdout == "Hello, World!"


async def test_send_special_characters_to_process(async_sandbox: AsyncSandbox):
    ev = asyncio.Event()

    def handle_event(stdout: str):
        ev.set()

    cmd = await async_sandbox.commands.run(
        "cat", background=True, on_stdout=handle_event, stdin=True
    )
    await async_sandbox.commands.send_stdin(cmd.pid, "!@#$%^&*()_+")

    await ev.wait()

    assert cmd.stdout == "!@#$%^&*()_+"


async def test_send_multiline_string_to_process(async_sandbox: AsyncSandbox):
    ev = asyncio.Event()

    def handle_event(stdout: str):
        ev.set()

    cmd = await async_sandbox.commands.run(
        "cat", background=True, on_stdout=handle_event, stdin=True
    )
    await async_sandbox.commands.send_stdin(cmd.pid, "Hello,\nWorld!")

    await ev.wait()

    assert cmd.stdout == "Hello,\nWorld!"
