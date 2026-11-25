import time

import pytest

from e2b import TimeoutException
from e2b_code_interpreter.code_interpreter_async import AsyncSandbox

TIMEOUT = 10
# The timeout must fire at TIMEOUT, not at twice it.
MAX_ELAPSED = TIMEOUT + 4


async def test_run_code_times_out_at_timeout(async_sandbox: AsyncSandbox):
    start = time.monotonic()
    with pytest.raises(TimeoutException):
        await async_sandbox.run_code("import time; time.sleep(30)", timeout=TIMEOUT)
    assert time.monotonic() - start < MAX_ELAPSED


async def test_run_code_longer_than_timeout_raises(async_sandbox: AsyncSandbox):
    # Finishes between TIMEOUT and 2 * TIMEOUT: with a doubled deadline it
    # would return normally.
    with pytest.raises(TimeoutException):
        await async_sandbox.run_code(
            "import time; time.sleep(13); print('done')", timeout=TIMEOUT
        )
