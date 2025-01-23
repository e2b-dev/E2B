import time

import pytest
from e2b import Sandbox


@pytest.mark.skip_debug()
def test_get_metrics(sandbox):
    time.sleep(2)

    metrics = sandbox.get_metrics()
    assert len(metrics) > 0
    assert metrics[0].cpu_pct is not None
    assert metrics[0].cpu_count is not None
    assert metrics[0].mem_used_mib is not None
    assert metrics[0].mem_total_mib is not None

    # test static method
    metrics2 = Sandbox.get_metrics(sandbox.sandbox_id)
    assert len(metrics2) > 0
    assert metrics2[0].cpu_pct is not None
    assert metrics2[0].cpu_count is not None
    assert metrics2[0].mem_used_mib is not None
    assert metrics2[0].mem_total_mib is not None
