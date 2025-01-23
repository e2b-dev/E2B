import asyncio
import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_get_metrics(async_sandbox: AsyncSandbox):

    await asyncio.sleep(2)
    metrics = await async_sandbox.get_metrics()

    assert len(metrics) > 0
    assert metrics[0].cpu_pct is not None
    assert metrics[0].cpu_count is not None
    assert metrics[0].mem_used_mib is not None
    assert metrics[0].mem_total_mib is not None
