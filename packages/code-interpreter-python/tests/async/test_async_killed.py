import asyncio

import pytest

from e2b import TimeoutException
from e2b_code_interpreter import AsyncSandbox


@pytest.mark.skip_debug
async def test_run_code_raises_when_sandbox_is_killed_during_execution(
    async_sandbox: AsyncSandbox,
):
    # Keep the execution firmly in-flight until the kill: the sleep is far
    # longer than the kill delay and the execution timeout is well beyond the
    # kill + disconnect-detection window, so the only thing that ends the
    # request is the sandbox being killed.
    execution = asyncio.create_task(
        async_sandbox.run_code("import time; time.sleep(300)", timeout=300)
    )

    await asyncio.sleep(2)
    await async_sandbox.kill()

    with pytest.raises(
        TimeoutException, match="sandbox was killed while the request was in progress"
    ):
        await execution
