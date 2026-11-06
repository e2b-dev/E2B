import datetime
import time

import pytest

from e2b import Sandbox


def _wait_for_logs(get_logs):
    logs = []
    for _ in range(60):
        logs = get_logs()
        if len(logs) > 0:
            break
        time.sleep(0.5)
    return logs


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
def test_sbx_logs(sandbox_factory):
    sbx = sandbox_factory(timeout=60)

    logs = _wait_for_logs(sbx.get_logs)

    assert len(logs) > 0
    log = logs[0]
    assert isinstance(log.timestamp, datetime.datetime)
    assert log.level in ("debug", "info", "warn", "error")
    assert isinstance(log.message, str)
    assert isinstance(log.fields, dict)


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
def test_sbx_logs_options(sandbox_factory):
    sbx = sandbox_factory(timeout=60)

    logs = _wait_for_logs(lambda: Sandbox.get_logs(sbx.sandbox_id, limit=2))
    assert len(logs) > 0

    limited = sbx.get_logs(limit=1)
    assert len(limited) == 1

    forward = sbx.get_logs(direction="forward")
    timestamps = [log.timestamp for log in forward]
    assert timestamps == sorted(timestamps)

    backward = sbx.get_logs(direction="backward")
    timestamps = [log.timestamp for log in backward]
    assert timestamps == sorted(timestamps, reverse=True)

    message = forward[0].message
    searched = sbx.get_logs(search=message)
    assert len(searched) > 0
    assert all(message in log.message for log in searched)

    missing = sbx.get_logs(search="e2b-sdk-test-no-such-log-line")
    assert len(missing) == 0

    errors_only = sbx.get_logs(level="error")
    assert all(log.level == "error" for log in errors_only)

    before_sandbox = sbx.get_logs(
        cursor=datetime.datetime.now(datetime.timezone.utc)
        - datetime.timedelta(hours=1),
        direction="backward",
    )
    assert len(before_sandbox) == 0
