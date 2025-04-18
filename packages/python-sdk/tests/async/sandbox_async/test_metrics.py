import asyncio

import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_get_metrics(async_sandbox):
    await asyncio.sleep(10_000)
    metrics = await async_sandbox.get_metrics()

    assert len(metrics) > 0
    assert metrics[0].cpu_used_pct is not None
    assert metrics[0].cpu_count is not None
    assert metrics[0].mem_used_mib is not None
    assert metrics[0].mem_total_mib is not None

    # test static method
    metrics2 = await AsyncSandbox.get_metrics(async_sandbox.sandbox_id)
    assert len(metrics2) > 0
    assert metrics2[0].cpu_used_pct is not None
    assert metrics2[0].cpu_count is not None
    assert metrics2[0].mem_used_mib is not None
    assert metrics2[0].mem_total_mib is not None
