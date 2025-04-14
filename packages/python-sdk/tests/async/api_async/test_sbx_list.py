import time

import pytest

from e2b import AsyncSandbox, SandboxListQuery


@pytest.mark.skip_debug()
async def test_list_sandboxes(async_sandbox: AsyncSandbox, sandbox_type: str):
    paginator = await AsyncSandbox.list(query=SandboxListQuery(metadata={"sandbox_type": sandbox_type}))
    sandboxes = await paginator.next_items()
    assert len(sandboxes) >= 1
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]


@pytest.mark.skip_debug()
async def test_list_sandboxes_with_filter(sandbox_type: str):
    unique_id = str(int(time.time()))
    extra_sbx = await AsyncSandbox.create(metadata={"unique_id": unique_id})

    try:
        paginator = await AsyncSandbox.list(query=SandboxListQuery(metadata={"unique_id": unique_id}))
        sandboxes = await paginator.next_items()
        assert len(sandboxes) == 1
        assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_list_running_sandboxes(async_sandbox: AsyncSandbox, sandbox_type: str):    
    paginator = await AsyncSandbox.list(
        query=SandboxListQuery(metadata={"sandbox_type": sandbox_type}, state=["running"])
    )
    sandboxes = await paginator.next_items()
    assert len(sandboxes) >= 1

    # Verify our running sandbox is in the list
    assert any(
        s.sandbox_id == async_sandbox.sandbox_id and s.state == "running"
        for s in sandboxes
    )


@pytest.mark.skip_debug()
async def test_list_paused_sandboxes(async_sandbox: AsyncSandbox, sandbox_type: str):
    await async_sandbox.pause()

    paginator = await AsyncSandbox.list(
        query=SandboxListQuery(metadata={"sandbox_type": sandbox_type}, state=["paused"])
    )
    sandboxes = await paginator.next_items()
    assert len(sandboxes) >= 1

    # Verify our paused sandbox is in the list
    paused_sandbox_id = async_sandbox.sandbox_id.split('-')[0]
    assert any(
        s.sandbox_id.startswith(paused_sandbox_id) and s.state == "paused"
        for s in sandboxes
    )


@pytest.mark.skip_debug()
async def test_paginate_running_sandboxes(async_sandbox: AsyncSandbox, sandbox_type: str):
    # Create extra sandbox
    extra_sbx = await AsyncSandbox.create(metadata={"sandbox_type": sandbox_type})

    try:
        # Test pagination with limit
        paginator = await AsyncSandbox.list(
            query=SandboxListQuery(metadata={"sandbox_type": sandbox_type}, state=["running"]),
            limit=1
        )
        sandboxes = await paginator.next_items()
        
        # Check first page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == "running"
        assert paginator.has_more_items is True
        assert paginator.next_token is not None
        assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id
        
        # Get second page
        sandboxes2 = await paginator.next_items()
        
        # Check second page
        assert len(sandboxes2) == 1
        assert sandboxes2[0].state == "running"
        assert paginator.has_more_items is False
        assert paginator.next_token is None
        assert sandboxes2[0].sandbox_id == async_sandbox.sandbox_id
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_paginate_paused_sandboxes(async_sandbox: AsyncSandbox, sandbox_type: str):
    sandbox_id = async_sandbox.sandbox_id.split('-')[0]
    await async_sandbox.pause()

    # create another paused sandbox
    extra_sbx = await AsyncSandbox.create(metadata={"sandbox_type": sandbox_type})
    extra_sbx_id = extra_sbx.sandbox_id.split('-')[0]
    await extra_sbx.pause()

    try:
        # Test pagination with limit
        paginator = await AsyncSandbox.list(
            query=SandboxListQuery(state=["paused"], metadata={"sandbox_type": sandbox_type}),
            limit=1
        )
        sandboxes = await paginator.next_items()

        # Check first page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == "paused"
        assert paginator.has_more_items is True
        assert paginator.next_token is not None
        assert sandboxes[0].sandbox_id.startswith(extra_sbx_id) is True
        
        # Get second page
        sandboxes2 = await paginator.next_items()

        # Check second page
        assert len(sandboxes2) == 1
        assert sandboxes2[0].state == "paused"
        assert paginator.has_more_items is False
        assert paginator.next_token is None
        assert sandboxes2[0].sandbox_id.startswith(sandbox_id) is True
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_paginate_running_and_paused_sandboxes(async_sandbox: AsyncSandbox, sandbox_type: str):
    # Create extra paused sandbox
    extra_sbx = await AsyncSandbox.create(metadata={"sandbox_type": sandbox_type})
    extra_sbx_id = extra_sbx.sandbox_id.split('-')[0]
    await extra_sbx.pause()
    
    try:
        # Test pagination with limit
        paginator = await AsyncSandbox.list(
            query=SandboxListQuery(metadata={"sandbox_type": sandbox_type}, state=["running", "paused"]),
            limit=1
        )
        sandboxes = await paginator.next_items()
        
        # Check first page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == "paused"
        assert paginator.has_more_items is True
        assert paginator.next_token is not None
        assert sandboxes[0].sandbox_id.startswith(extra_sbx_id) is True
        
        # Get second page
        sandboxes2 = await paginator.next_items()
        
        # Check second page
        assert len(sandboxes2) == 1
        assert sandboxes2[0].state == "running"
        assert paginator.has_more_items is False
        assert paginator.next_token is None
        assert sandboxes2[0].sandbox_id == async_sandbox.sandbox_id
    finally:
        await extra_sbx.kill()


@pytest.mark.skip_debug()
async def test_paginate_iterator(async_sandbox: AsyncSandbox, sandbox_type: str):
    paginator = await AsyncSandbox.list(query=SandboxListQuery(metadata={"sandbox_type": sandbox_type}))
    sandboxes_list = []

    while paginator.has_more_items:
        sandboxes = await paginator.next_items()
        sandboxes_list.extend(sandboxes)

    assert len(sandboxes_list) > 0
    assert async_sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes_list]