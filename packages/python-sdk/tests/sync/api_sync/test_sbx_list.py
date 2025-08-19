import time

import pytest

from e2b import Sandbox, SandboxQuery, SandboxState


@pytest.mark.skip_debug()
def test_list_sandboxes(sandbox: Sandbox, sandbox_test_id: str):
    paginator = Sandbox.list(
        query=SandboxQuery(metadata={"sandbox_test_id": sandbox_test_id})
    )
    sandboxes = paginator.next_items()
    assert len(sandboxes) >= 1
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]


@pytest.mark.skip_debug()
def test_list_sandboxes_with_filter(sandbox_test_id: str):
    unique_id = str(int(time.time()))
    extra_sbx = Sandbox.create(metadata={"unique_id": unique_id})

    try:
        paginator = Sandbox.list(query=SandboxQuery(metadata={"unique_id": unique_id}))
        sandboxes = paginator.next_items()
        assert len(sandboxes) == 1
        assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_list_running_sandboxes(sandbox: Sandbox, sandbox_test_id: str):
    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id}, state=[SandboxState.RUNNING]
        )
    )
    sandboxes = paginator.next_items()
    assert len(sandboxes) >= 1

    # Verify our running sandbox is in the list
    assert any(
        s.sandbox_id == sandbox.sandbox_id and s.state == SandboxState.RUNNING
        for s in sandboxes
    )


@pytest.mark.skip_debug()
def test_list_paused_sandboxes(sandbox: Sandbox, sandbox_test_id: str):
    sandbox.beta_pause()

    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id}, state=[SandboxState.PAUSED]
        )
    )
    sandboxes = paginator.next_items()
    assert len(sandboxes) >= 1

    # Verify our paused sandbox is in the list
    paused_sandbox_id = sandbox.sandbox_id.split("-")[0]
    assert any(
        s.sandbox_id.startswith(paused_sandbox_id) and s.state == SandboxState.PAUSED
        for s in sandboxes
    )


@pytest.mark.skip_debug()
def test_paginate_running_sandboxes(sandbox: Sandbox, sandbox_test_id: str):
    # Create two sandboxes
    extra_sbx = Sandbox.create(metadata={"sandbox_test_id": sandbox_test_id})

    try:
        # Test pagination with limit
        paginator = Sandbox.list(
            query=SandboxQuery(
                metadata={"sandbox_test_id": sandbox_test_id},
                state=[SandboxState.RUNNING],
            ),
            limit=1,
        )

        sandboxes = paginator.next_items()

        # Check first page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == SandboxState.RUNNING
        assert paginator.has_next is True
        assert paginator.next_token is not None
        assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id

        # Get second page
        sandboxes = paginator.next_items()

        # Check second page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == SandboxState.RUNNING
        assert paginator.has_next is False
        assert paginator.next_token is None
        assert sandboxes[0].sandbox_id == sandbox.sandbox_id
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_paginate_paused_sandboxes(sandbox: Sandbox, sandbox_test_id: str):
    sandbox_id = sandbox.sandbox_id.split("-")[0]
    sandbox.beta_pause()

    # create another paused sandbox
    extra_sbx = Sandbox.create(metadata={"sandbox_test_id": sandbox_test_id})
    extra_sbx_id = extra_sbx.sandbox_id.split("-")[0]
    extra_sbx.beta_pause()

    try:
        # Test pagination with limit
        paginator = Sandbox.list(
            query=SandboxQuery(
                state=[SandboxState.PAUSED],
                metadata={"sandbox_test_id": sandbox_test_id},
            ),
            limit=1,
        )

        sandboxes = paginator.next_items()

        # Check first page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == SandboxState.PAUSED
        assert paginator.has_next is True
        assert paginator.next_token is not None
        assert sandboxes[0].sandbox_id.startswith(extra_sbx_id) is True

        # Get second page
        sandboxes = paginator.next_items()

        # Check second page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == SandboxState.PAUSED
        assert paginator.has_next is False
        assert paginator.next_token is None
        assert sandboxes[0].sandbox_id.startswith(sandbox_id) is True
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_paginate_running_and_paused_sandboxes(sandbox: Sandbox, sandbox_test_id: str):
    # Create extra paused sandbox
    extra_sbx = Sandbox.create(metadata={"sandbox_test_id": sandbox_test_id})
    extra_sbx_id = extra_sbx.sandbox_id.split("-")[0]
    extra_sbx.beta_pause()

    try:
        # Test pagination with limit
        paginator = Sandbox.list(
            query=SandboxQuery(
                metadata={"sandbox_test_id": sandbox_test_id},
                state=[SandboxState.RUNNING, SandboxState.PAUSED],
            ),
            limit=1,
        )

        sandboxes = paginator.next_items()

        # Check first page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == SandboxState.PAUSED
        assert paginator.has_next is True
        assert paginator.next_token is not None
        assert sandboxes[0].sandbox_id.startswith(extra_sbx_id) is True

        # Get second page
        sandboxes = paginator.next_items()

        # Check second page
        assert len(sandboxes) == 1
        assert sandboxes[0].state == SandboxState.RUNNING
        assert paginator.has_next is False
        assert paginator.next_token is None
        assert sandboxes[0].sandbox_id == sandbox.sandbox_id
    finally:
        extra_sbx.kill()


@pytest.mark.skip_debug()
def test_paginate_iterator(sandbox: Sandbox, sandbox_test_id: str):
    paginator = Sandbox.list(
        query=SandboxQuery(metadata={"sandbox_test_id": sandbox_test_id})
    )
    sandboxes_list = []

    while paginator.has_next:
        sandboxes = paginator.next_items()
        sandboxes_list.extend(sandboxes)

    assert len(sandboxes_list) > 0
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes_list]
