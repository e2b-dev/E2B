import datetime
import time

import pytest


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
def test_sbx_metrics(sandbox_factory) -> None:
    sbx = sandbox_factory(timeout=60)

    # Wait for the sandbox to have some metrics
    metrics = []
    for _ in range(60):
        metrics = sbx.get_metrics()
        if len(metrics) > 0:
            break
        time.sleep(0.5)

    assert len(metrics) > 0

    metric = metrics[0]
    assert metric.cpu_count is not None
    assert metric.cpu_used_pct is not None
    assert metric.mem_used is not None
    assert metric.mem_total is not None
    assert metric.disk_used is not None
    assert metric.disk_total is not None


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
def test_sbx_metrics_time_range(sandbox_factory) -> None:
    start_time = datetime.datetime.now(datetime.timezone.utc)
    sbx = sandbox_factory(timeout=60)

    # Wait for the sandbox to have some metrics within the test's time window
    metrics = []
    end_time = start_time
    for _ in range(60):
        end_time = datetime.datetime.now(datetime.timezone.utc)
        metrics = sbx.get_metrics(start=start_time, end=end_time)
        if len(metrics) > 0:
            break
        time.sleep(0.5)

    assert len(metrics) > 0

    # All returned metrics must fall within the requested time range
    # (10s slack - metric timestamps are aligned to collection buckets,
    # currently 5s, and the query params are second-precision)
    slack = 10
    for metric in metrics:
        assert metric.timestamp.timestamp() >= start_time.timestamp() - slack
        assert metric.timestamp.timestamp() <= end_time.timestamp() + slack

    # A time range from before the sandbox existed must return no metrics
    metrics = sbx.get_metrics(
        start=start_time - datetime.timedelta(hours=1),
        end=start_time - datetime.timedelta(minutes=30),
    )
    assert len(metrics) == 0
