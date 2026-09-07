import asyncio

import pytest

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def wait_for_health(sandbox: AsyncSandbox, max_retries=10, interval_ms=100):
    for _ in range(max_retries):
        try:
            result = await sandbox.commands.run(
                'curl -s -o /dev/null -w "%{http_code}" http://0.0.0.0:49999/health'
            )
            if result.stdout.strip() == "200":
                return True
        except Exception:
            pass
        await asyncio.sleep(interval_ms / 1000)
    return False


@pytest.mark.skip_debug
async def test_restart_after_jupyter_kill(async_sandbox: AsyncSandbox):
    # Verify health is up initially
    assert await wait_for_health(async_sandbox)

    # Kill the jupyter process as root
    # The command handle may get killed too (killing jupyter cascades to code-interpreter),
    # so we catch the error.
    try:
        await async_sandbox.commands.run(
            "kill -9 $(pgrep -f 'jupyter server')", user="root"
        )
    except Exception:
        pass

    # Wait for systemd to restart both services
    assert await wait_for_health(async_sandbox, 60, 500)

    # Verify code execution works after recovery
    result = await async_sandbox.run_code("x = 1; x")
    assert result.text == "1"


@pytest.mark.skip_debug
async def test_restart_after_code_interpreter_kill(async_sandbox: AsyncSandbox):
    # Verify health is up initially
    assert await wait_for_health(async_sandbox)

    # Kill the code-interpreter process as root
    try:
        await async_sandbox.commands.run(
            "kill -9 $(pgrep -f 'uvicorn main:app')", user="root"
        )
    except Exception:
        pass

    # Wait for systemd to restart it and health to come back
    assert await wait_for_health(async_sandbox, 60, 500)

    # Verify code execution works after recovery
    result = await async_sandbox.run_code("x = 1; x")
    assert result.text == "1"
