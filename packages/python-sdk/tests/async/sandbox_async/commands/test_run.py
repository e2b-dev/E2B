import time

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


#   assert cmd.stdout == f"{text}\n"


async def test_run_with_broken_utf8(async_sandbox: AsyncSandbox):
    # Create a string with 8191 'a' characters followed by the problematic byte 0xe2
    long_str = "a" * 8191 + "\\xe2"
    result = await async_sandbox.commands.run(f'printf "{long_str}"')
    assert result.exit_code == 0

    # The broken UTF-8 bytes should be replaced with the Unicode replacement character
    assert result.stdout == ("a" * 8191 + "\ufffd")


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


@pytest.mark.timeout(60)
async def test_background_run_is_capped_by_timeout(async_sandbox: AsyncSandbox):
    start = time.time()
    cmd = await async_sandbox.commands.run("sleep 20", background=True, timeout=10)
    with pytest.raises(TimeoutException):
        await cmd.wait()
    # The command is capped by the timeout instead of running for the full 20s.
    assert time.time() - start < 20


@pytest.mark.timeout(60)
async def test_background_run_without_timeout_completes(async_sandbox: AsyncSandbox):
    # Background commands default to no timeout, so a long command completes.
    cmd = await async_sandbox.commands.run("sleep 20", background=True)
    result = await cmd.wait()
    assert result.exit_code == 0
