import pytest
import anyio

from e2b import AsyncSandbox


@pytest.mark.anyio
async def test_send_stdin_to_process(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("cat", background=True)
    await async_sandbox.commands.send_stdin(cmd.pid, "Hello, World!")

    await anyio.sleep(2)

    assert cmd.stdout == "Hello, World!"


@pytest.mark.anyio
async def test_send_special_characters_to_process(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("cat", background=True)
    await async_sandbox.commands.send_stdin(cmd.pid, "!@#$%^&*()_+")

    await anyio.sleep(2)

    assert cmd.stdout == "!@#$%^&*()_+"


@pytest.mark.anyio
async def test_send_multiline_string_to_process(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run("cat", background=True)
    await async_sandbox.commands.send_stdin(cmd.pid, "Hello,\nWorld!")

    await anyio.sleep(2)

    assert cmd.stdout == "Hello,\nWorld!"
