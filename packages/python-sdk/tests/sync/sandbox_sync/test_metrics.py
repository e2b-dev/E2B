import time

import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_sbx_metrics(sandbox: Sandbox):
    # Wait for the sandbox to have some metrics
    metrics = []
    for _ in range(10):
        metrics = sandbox.get_metrics()
        if len(metrics) > 0:
            break
        time.sleep(1)

    assert len(metrics) > 0

    metric = metrics[0]
    assert metric.cpu_count is not None
    assert metric.cpu_used_pct is not None
    assert metric.mem_used is not None
    assert metric.mem_total is not None
    assert metric.disk_used is not None
    assert metric.disk_total is not None
