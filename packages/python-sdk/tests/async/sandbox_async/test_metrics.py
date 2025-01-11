import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_get_metrics(async_sandbox: AsyncSandbox):
    metrics = await async_sandbox.get_metrics()
    assert len(metrics) > 0
    assert metrics[0].cpu_pct is not None
    assert metrics[0].cpu_count is not None
    assert metrics[0].mem_mib_used is not None
    assert metrics[0].mem_mib_total is not None
