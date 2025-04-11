import time

import pytest

from e2b import Sandbox

@pytest.mark.skip_debug()
def test_list_sandboxes(sandbox: Sandbox):
    sandboxes = Sandbox.list()
    assert len(sandboxes.sandboxes) >= 1
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]


@pytest.mark.skip_debug()
def test_list_sandboxes_with_filter():
    unique_id = str(int(time.time()))
    extra_sbx = Sandbox(metadata={"unique_id": unique_id})
    
    try:
        sandboxes = Sandbox.list(query=Sandbox.SandboxQuery(metadata={"unique_id": unique_id}))
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].sandbox_id == extra_sbx.sandbox_id
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_list_running_sandboxes(sandbox: Sandbox):
    extra_sbx = Sandbox(metadata={"sandbox_type": "test"})
    
    try:
        sandboxes = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["running"])
        )
        assert len(sandboxes.sandboxes) >= 1
        
        # Verify our running sandbox is in the list
        found = any(
            s.sandbox_id == extra_sbx.sandbox_id and s.state == "running"
            for s in sandboxes.sandboxes
        )
        assert found is True
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_list_paused_sandboxes(sandbox: Sandbox):
    # Create and pause a sandbox
    extra_sbx = Sandbox(metadata={"sandbox_type": "test"})
    extra_sbx.pause()
    
    try:
        sandboxes = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["paused"])
        )
        assert len(sandboxes.sandboxes) >= 1
        
        # Verify our paused sandbox is in the list
        paused_sandbox_id = extra_sbx.sandbox_id.split('-')[0]
        found = any(
            s.sandbox_id.startswith(paused_sandbox_id) and s.state == "paused"
            for s in sandboxes.sandboxes
        )
        assert found is True
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_paginate_running_sandboxes(sandbox: Sandbox):
    # Create two sandboxes
    sandbox1 = Sandbox(metadata={"sandbox_type": "test"})
    sandbox2 = Sandbox(metadata={"sandbox_type": "test"})
    
    try:
        # Test pagination with limit
        sandboxes = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["running"]),
            limit=1
        )
        
        # Check first page
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "running"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert sandboxes.sandboxes[0].sandbox_id == sandbox2.sandbox_id
        
        # Get second page using the next token
        sandboxes2 = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["running"]),
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
        sandbox1.kill()
        sandbox2.kill()


@pytest.mark.skip_debug()
def test_paginate_paused_sandboxes(sandbox: Sandbox):
    # Create two paused sandboxes
    sandbox1 = Sandbox(metadata={"sandbox_type": "test"})
    sandbox1_id = sandbox1.sandbox_id.split('-')[0]
    sandbox1.pause()

    sandbox2 = Sandbox(metadata={"sandbox_type": "test"})
    sandbox2_id = sandbox2.sandbox_id.split('-')[0]
    sandbox2.pause()

    try:
        # Test pagination with limit
        sandboxes = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["paused"]),
            limit=1
        )

        # Check first page
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "paused"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert sandboxes.sandboxes[0].sandbox_id.startswith(sandbox2_id) is True
        
        # Get second page using the next token
        sandboxes2 = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["paused"]),
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
        sandbox1.kill()
        sandbox2.kill()


@pytest.mark.skip_debug()
def test_paginate_running_and_paused_sandboxes(sandbox: Sandbox):
    # Create two sandboxes
    sandbox1 = Sandbox(metadata={"sandbox_type": "test"})
    sandbox2 = Sandbox(metadata={"sandbox_type": "test"})
    sandbox2_id = sandbox2.sandbox_id.split('-')[0]
    
    # Pause the second sandbox
    sandbox2.pause()
    
    try:
        # Test pagination with limit
        sandboxes = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["running", "paused"]),
            limit=1
        )
        
        # Check first page
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "paused"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert sandboxes.sandboxes[0].sandbox_id.startswith(sandbox2_id) is True
        
        # Get second page using the next token
        sandboxes2 = Sandbox.list(
            query=Sandbox.SandboxQuery(metadata={"sandbox_type": "test"}, state=["running", "paused"]),
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
        sandbox1.kill()
        sandbox2.kill()

@pytest.mark.skip_debug()
def test_paginate_iterator(sandbox: Sandbox):
    sandboxes = Sandbox.list()
    sandboxes_list = []

    for sbx in sandboxes.iterator:
        sandboxes_list.append(sbx)

    assert len(sandboxes_list) > 0
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes_list]