import asyncio

import pytest

from e2b import TimeoutException
from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_subsequent_execution_works_after_client_timeout(
    async_sandbox: AsyncSandbox,
):
    # Start a long-running execution with a short timeout.
    # This simulates a client disconnect: the SDK closes the connection,
    # which should trigger the server to interrupt the kernel (#213).
    with pytest.raises(TimeoutException):
        await async_sandbox.run_code("import time; time.sleep(300)", timeout=3)

    # Wait for the server to detect the disconnect (via keepalive write
    # failure) and interrupt the kernel.
    await asyncio.sleep(5)

    # Run a simple execution. Without the kernel interrupt fix, this would
    # block behind the still-running sleep(30) and time out.
    result = await async_sandbox.run_code("1 + 1", timeout=10)
    assert result.text == "2"
