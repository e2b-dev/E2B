import random
import string

import pytest

from e2b import AsyncSandbox
from e2b.sandbox.sandbox_api import SandboxQuery


@pytest.mark.skip_debug()
async def test_list_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list()
    assert len(sandboxes.sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]


@pytest.mark.skip_debug()
async def test_list_sandboxes_with_filter(async_sandbox: AsyncSandbox):
    unique_id = "".join(random.choices(string.ascii_letters, k=5))
    sbx = await AsyncSandbox.create(metadata={"unique_id": unique_id})
    try:
        # There's an extra sandbox created by the test runner
        sandboxes = await AsyncSandbox.list(query=SandboxQuery(metadata={"unique_id": unique_id}))
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].metadata["unique_id"] == unique_id
    finally:
        await sbx.kill()

@pytest.mark.skip_debug()
async def test_list_paused_sandboxes(async_sandbox: AsyncSandbox):
    paused_sandbox = await async_sandbox.pause()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"    
    sandboxes = await AsyncSandbox.list(state=["paused"])
    assert len(sandboxes.sandboxes) > 0
    assert paused_sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

@pytest.mark.skip_debug()
async def test_list_running_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list(state=["running"])
    assert len(sandboxes.sandboxes) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

@pytest.mark.skip_debug()
async def test_list_sandboxes_with_limit(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list(limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

@pytest.mark.skip_debug()
async def test_paginate_running_sandboxes(async_sandbox: AsyncSandbox):
    extra_sbx = await AsyncSandbox.create()

    # Check first page
    sandboxes = await AsyncSandbox.list(state=["running"], limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert sandboxes.sandboxes[0].state == "running"
    assert sandboxes.has_more_items is True
    assert sandboxes.next_token is not None

    # Check second page
    sandboxes2 = await AsyncSandbox.list(state=["running"], next_token=sandboxes.next_token, limit=1)
    assert len(sandboxes2.sandboxes) == 1
    assert sandboxes2.sandboxes[0].state == "running"
    assert sandboxes2.has_more_items is False
    assert sandboxes2.next_token is None

    await extra_sbx.kill()

@pytest.mark.skip_debug()
async def test_paginate_paused_sandboxes(async_sandbox: AsyncSandbox):
    # Pause the current sandbox
    await async_sandbox.pause()

    # Create and pause a new sandbox
    extra_sbx = await AsyncSandbox.create()
    await extra_sbx.pause()

    # Check first page
    sandboxes = await AsyncSandbox.list(state=["paused"], limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert sandboxes.sandboxes[0].state == "paused"
    assert sandboxes.has_more_items is True
    assert sandboxes.next_token is not None

    # Check second page
    sandboxes2 = await AsyncSandbox.list(state=["paused"], next_token=sandboxes.next_token, limit=1)
    assert len(sandboxes2.sandboxes) == 1
    assert sandboxes2.sandboxes[0].state == "paused"
    assert sandboxes2.has_more_items is False
    assert sandboxes2.next_token is None

    await extra_sbx.kill()

@pytest.mark.skip_debug()
async def test_paginate_paused_and_running_sandboxes(async_sandbox: AsyncSandbox):
    # Create and pause a new sandbox
    extra_sbx = await AsyncSandbox.create()
    await extra_sbx.pause()

    # Check first page
    sandboxes = await AsyncSandbox.list(state=["paused", "running"], limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert sandboxes.sandboxes[0].state == "paused"
    assert sandboxes.has_more_items is True
    assert sandboxes.next_token is not None

    # Check second page
    sandboxes2 = await AsyncSandbox.list(state=["paused", "running"], next_token=sandboxes.next_token, limit=1)
    assert len(sandboxes2.sandboxes) == 1
    assert sandboxes2.sandboxes[0].state == "running"
    assert sandboxes2.has_more_items is False
    assert sandboxes2.next_token is None

    await extra_sbx.kill()