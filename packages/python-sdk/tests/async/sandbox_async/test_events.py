import asyncio
import uuid
from datetime import datetime

import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
async def test_sandbox_events(async_sandbox_factory) -> None:
    sandbox = await async_sandbox_factory(timeout=60)
    events = []
    for _ in range(60):
        events = await sandbox.get_events()
        if any(event.type == "sandbox.lifecycle.created" for event in events):
            break
        await asyncio.sleep(0.5)

    event = next(
        (event for event in events if event.type == "sandbox.lifecycle.created"),
        None,
    )
    assert event is not None
    assert event.sandbox_id == sandbox.sandbox_id
    assert isinstance(event.timestamp, datetime)
    for value in (
        event.id,
        event.version,
        event.sandbox_execution_id,
        event.sandbox_template_id,
        event.sandbox_build_id,
        event.sandbox_team_id,
    ):
        assert isinstance(value, str)
        assert value
    if event.event_data is not None:
        assert isinstance(event.event_data, dict)

    filtered_events = await AsyncSandbox.get_events(
        sandbox.sandbox_id,
        types=["sandbox.lifecycle.created"],
        limit=1,
        order_asc=True,
    )
    assert len(filtered_events) == 1
    assert filtered_events[0].type == "sandbox.lifecycle.created"


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
async def test_unknown_sandbox_events() -> None:
    assert await AsyncSandbox.get_events(f"missing-{uuid.uuid4()}") == []
