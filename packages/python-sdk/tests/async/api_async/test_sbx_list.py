import time

import pytest

from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_list_sandboxes(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list()
    assert len(sandboxes.sandboxes) >= 1
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]


@pytest.mark.skip_debug()
async def test_list_sandboxes_with_filter():
    unique_id = str(int(time.time()))
    extra_sbx = await AsyncSandbox.create(metadata={"unique_id": unique_id})
    
    try:
        sandboxes = await AsyncSandbox.list(query=AsyncSandbox.SandboxQuery(metadata={"unique_id": unique_id}))
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].sandbox_id == extra_sbx.sandbox_id
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_list_running_sandboxes(async_sandbox: AsyncSandbox):
    extra_sbx = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    
    try:
        sandboxes = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["running"], metadata={"sandbox_type": "test"})
        )
        assert len(sandboxes.sandboxes) >= 1
        
        # Verify our running sandbox is in the list
        assert any(
            s.sandbox_id == extra_sbx.sandbox_id and s.state == "running"
            for s in sandboxes.sandboxes
        )
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_list_paused_sandboxes(async_sandbox: AsyncSandbox):
    # Create and pause a sandbox
    extra_sbx = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    await extra_sbx.pause()
    
    try:
        sandboxes = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["paused"], metadata={"sandbox_type": "test"})
        )
        assert len(sandboxes.sandboxes) >= 1
        
        # Verify our paused sandbox is in the list
        paused_sandbox_id = extra_sbx.sandbox_id.split('-')[0]
        assert any(
            s.sandbox_id.startswith(paused_sandbox_id) and s.state == "paused"
            for s in sandboxes.sandboxes
        )
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_paginate_running_sandboxes(async_sandbox: AsyncSandbox):
    # Create two sandboxes
    sandbox1 = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    sandbox2 = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    
    try:
        # Test pagination with limit
        sandboxes = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["running"], metadata={"sandbox_type": "test"}),
            limit=1
        )
        
        # Check first page
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "running"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert sandboxes.sandboxes[0].sandbox_id == sandbox2.sandbox_id
        
        # Get second page using the next token
        sandboxes2 = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["running"], metadata={"sandbox_type": "test"}),
            limit=1,
            next_token=sandboxes.next_token
        )
        
        # Check second page
        assert len(sandboxes2.sandboxes) == 1
        assert sandboxes2.sandboxes[0].state == "running"
        assert sandboxes2.has_more_items is False
        assert sandboxes2.next_token is None
        assert sandboxes2.sandboxes[0].sandbox_id == sandbox1.sandbox_id
    finally:
        await sandbox1.kill()
        await sandbox2.kill()


@pytest.mark.skip_debug()
async def test_paginate_paused_sandboxes(async_sandbox: AsyncSandbox):
    # Create two paused sandboxes
    sandbox1 = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    sandbox1_id = sandbox1.sandbox_id.split('-')[0]
    await sandbox1.pause()

    sandbox2 = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    sandbox2_id = sandbox2.sandbox_id.split('-')[0]
    await sandbox2.pause()

    try:
        # Test pagination with limit
        sandboxes = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["paused"], metadata={"sandbox_type": "test"}),
            limit=1
        )

        # Check first page
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "paused"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert sandboxes.sandboxes[0].sandbox_id.startswith(sandbox2_id) is True
        
        # Get second page using the next token
        sandboxes2 = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["paused"], metadata={"sandbox_type": "test"}),
            limit=1,
            next_token=sandboxes.next_token
        )

        # Check second page
        assert len(sandboxes2.sandboxes) == 1
        assert sandboxes2.sandboxes[0].state == "paused"
        assert sandboxes2.has_more_items is False
        assert sandboxes2.next_token is None
        assert sandboxes2.sandboxes[0].sandbox_id.startswith(sandbox1_id) is True
    finally:
        await sandbox1.kill()
        await sandbox2.kill()


@pytest.mark.skip_debug()
async def test_paginate_running_and_paused_sandboxes(async_sandbox: AsyncSandbox):
    # Create two sandboxes
    sandbox1 = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    sandbox2 = await AsyncSandbox.create(metadata={"sandbox_type": "test"})
    sandbox2_id = sandbox2.sandbox_id.split('-')[0]
    
    # Pause the second sandbox
    await sandbox2.pause()
    
    try:
        # Test pagination with limit
        sandboxes = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["running", "paused"], metadata={"sandbox_type": "test"}),
            limit=1
        )
        
        # Check first page
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "paused"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert sandboxes.sandboxes[0].sandbox_id.startswith(sandbox2_id) is True
        
        # Get second page using the next token
        sandboxes2 = await AsyncSandbox.list(
            query=AsyncSandbox.SandboxQuery(state=["running", "paused"], metadata={"sandbox_type": "test"}),
            limit=1,
            next_token=sandboxes.next_token
        )
        
        # Check second page
        assert len(sandboxes2.sandboxes) == 1
        assert sandboxes2.sandboxes[0].state == "running"
        assert sandboxes2.has_more_items is False
        assert sandboxes2.next_token is None
        assert sandboxes2.sandboxes[0].sandbox_id == sandbox1.sandbox_id
    finally:
        await sandbox1.kill()
        await sandbox2.kill()

@pytest.mark.skip_debug()
async def test_paginate_iterator(async_sandbox: AsyncSandbox):
    sandboxes = await AsyncSandbox.list()
    sandboxes_list = []

    async for sbx in sandboxes.iterator:
        sandboxes_list.append(sbx)

    assert len(sandboxes_list) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes_list]