import asyncio
import datetime

import pytest

from e2b import AsyncSandbox


async def _wait_for_logs(get_logs):
    logs = []
    for _ in range(60):
        logs = await get_logs()
        if len(logs) > 0:
            break
        await asyncio.sleep(0.5)
    return logs


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
async def test_sbx_logs(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=60)

    logs = await _wait_for_logs(sbx.get_logs)

    assert len(logs) > 0
    log = logs[0]
    assert isinstance(log.timestamp, datetime.datetime)
    assert log.level in ("debug", "info", "warn", "error")
    assert isinstance(log.message, str)
    assert isinstance(log.fields, dict)


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
async def test_sbx_logs_options(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=60)

    logs = await _wait_for_logs(lambda: AsyncSandbox.get_logs(sbx.sandbox_id, limit=2))
    assert len(logs) > 0

    limited = await sbx.get_logs(limit=1)
    assert len(limited) == 1

    forward = await sbx.get_logs(direction="forward")
    timestamps = [log.timestamp for log in forward]
    assert timestamps == sorted(timestamps)

    backward = await sbx.get_logs(direction="backward")
    timestamps = [log.timestamp for log in backward]
    assert timestamps == sorted(timestamps, reverse=True)

    message = forward[0].message
    searched = await sbx.get_logs(search=message)
    assert len(searched) > 0
    assert all(message in log.message for log in searched)

    missing = await sbx.get_logs(search="e2b-sdk-test-no-such-log-line")
    assert len(missing) == 0

    errors_only = await sbx.get_logs(level="error")
    assert all(log.level == "error" for log in errors_only)

    before_sandbox = await sbx.get_logs(
        cursor=datetime.datetime.now(datetime.timezone.utc)
        - datetime.timedelta(hours=1),
        direction="backward",
    )
    assert len(before_sandbox) == 0
