import pytest


@pytest.mark.skip_debug()
async def test_get_metrics(sandbox):
    metrics = sandbox.get_metrics()
    assert len(metrics) > 0
    assert metrics[0].cpu_pct is not None
    assert metrics[0].cpu_count is not None
    assert metrics[0].mem_mib_used is not None
    assert metrics[0].mem_mib_total is not None
