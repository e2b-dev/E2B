import time
import datetime

import pytest

from e2b import Sandbox


def _wait_for_logs(get_logs):
    logs = []
    for _ in range(60):
        logs = get_logs().next_items()
        if len(logs) > 0:
            break
        time.sleep(0.5)
    return logs


def _read_all(paginator):
    logs = []
    while paginator.has_next:
        logs.extend(paginator.next_items())
    return logs


def _key(log):
    return (log.timestamp, log.level, log.message, tuple(sorted(log.fields.items())))


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

    logs = _wait_for_logs(lambda: Sandbox.get_logs(sbx.sandbox_id))
    assert len(logs) > 0

    limited = sbx.get_logs(limit=1)
    assert len(limited.next_items()) == 1
    assert limited.has_next

    forward = sbx.get_logs(direction="forward").next_items()
    timestamps = [log.timestamp for log in forward]
    assert timestamps == sorted(timestamps)

    backward = sbx.get_logs(direction="backward").next_items()
    timestamps = [log.timestamp for log in backward]
    assert timestamps == sorted(timestamps, reverse=True)

    message = forward[0].message
    searched = sbx.get_logs(search=message).next_items()
    assert len(searched) > 0
    assert all(message in log.message for log in searched)

    missing = sbx.get_logs(search="e2b-sdk-test-no-such-log-line")
    assert len(missing.next_items()) == 0
    assert not missing.has_next

    errors_only = sbx.get_logs(level="error").next_items()
    assert all(log.level == "error" for log in errors_only)

    before_sandbox = sbx.get_logs(
        cursor=datetime.datetime.now(datetime.timezone.utc)
        - datetime.timedelta(hours=1),
        direction="backward",
    ).next_items()
    assert len(before_sandbox) == 0


@pytest.mark.skip_debug()
@pytest.mark.timeout(120)
@pytest.mark.parametrize("direction", ["forward", "backward"])
def test_sbx_logs_pagination(sandbox_factory, direction):
    sbx = sandbox_factory(timeout=120)

    _wait_for_logs(sbx.get_logs)
    sbx.commands.run("echo hello")
    time.sleep(2)

    all_logs = sbx.get_logs(direction=direction).next_items()
    paged = _read_all(sbx.get_logs(direction=direction, limit=2))

    keys = [_key(log) for log in paged]
    assert len(set(keys)) == len(keys)
    assert {_key(log) for log in all_logs} <= set(keys)

    timestamps = [log.timestamp for log in paged]
    assert timestamps == sorted(timestamps, reverse=direction == "backward")
