import pytest

from e2b import AsyncSandbox, TimeoutException


async def test_run(async_sandbox: AsyncSandbox):
    text = "Hello, World!"

    cmd = await async_sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


async def test_run_with_special_characters(async_sandbox: AsyncSandbox):
    text = "!@#$%^&*()_+"

    cmd = await async_sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


async def test_run_with_multiline_string(async_sandbox: AsyncSandbox):
    text = "Hello,\nWorld!"

    cmd = await async_sandbox.commands.run(f'echo "{text}"')

    assert cmd.exit_code == 0
    assert cmd.stdout == f"{text}\n"


async def test_run_with_timeout(async_sandbox: AsyncSandbox):
    cmd = await async_sandbox.commands.run('echo "Hello, World!"', timeout=10)

    assert cmd.exit_code == 0


async def test_run_with_too_short_timeout(async_sandbox: AsyncSandbox):
    with pytest.raises(TimeoutException):
        await async_sandbox.commands.run("sleep 10", timeout=2)
