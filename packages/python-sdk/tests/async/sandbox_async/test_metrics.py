import asyncio

import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_sbx_metrics(async_sandbox: AsyncSandbox):
    # Wait for the sandbox to have some metrics
    metrics = []
    for _ in range(10):
        metrics = await async_sandbox.get_metrics()
        if len(metrics) > 0:
            break
        await asyncio.sleep(1)

    assert len(metrics) > 0

    metric = metrics[0]
    assert metric.cpu_count is not None
    assert metric.cpu_used_pct is not None
    assert metric.mem_used is not None
    assert metric.mem_total is not None
    assert metric.disk_used is not None
    assert metric.disk_total is not None
