import uuid

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
def test_list_sandboxes_with_filter(sandbox_factory, sandbox_test_id: str):
    unique_id = str(uuid.uuid4())
    extra_sbx = sandbox_factory(metadata={"unique_id": unique_id})

    paginator = Sandbox.list(query=SandboxQuery(metadata={"unique_id": unique_id}))
    sandboxes = paginator.next_items()
    assert len(sandboxes) == 1
    assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id


@pytest.mark.skip_debug()
def test_list_by_state(sandbox_factory, sandbox_test_id: str):
    running_sbx = sandbox_factory()
    paused_sbx = sandbox_factory()
    paused_sbx.beta_pause()

    running_paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            state=[SandboxState.RUNNING],
        )
    )
    running_sandboxes = running_paginator.next_items()
    assert len(running_sandboxes) >= 1
    assert any(
        s.sandbox_id == running_sbx.sandbox_id and s.state == SandboxState.RUNNING
        for s in running_sandboxes
    )

    paused_paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            state=[SandboxState.PAUSED],
        )
    )
    paused_sandboxes = paused_paginator.next_items()
    assert len(paused_sandboxes) >= 1
    assert any(
        s.sandbox_id == paused_sbx.sandbox_id and s.state == SandboxState.PAUSED
        for s in paused_sandboxes
    )


@pytest.mark.skip_debug()
def test_paginate_sandboxes(sandbox: Sandbox, sandbox_factory, sandbox_test_id: str):
    extra_sbx = sandbox_factory(metadata={"sandbox_test_id": sandbox_test_id})

    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            state=[SandboxState.RUNNING],
        ),
        limit=1,
    )

    sandboxes = paginator.next_items()

    assert len(sandboxes) == 1
    assert sandboxes[0].state == SandboxState.RUNNING
    assert paginator.has_next is True
    assert paginator.next_token is not None
    assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id

    sandboxes2 = paginator.next_items()

    assert len(sandboxes2) == 1
    assert sandboxes2[0].state == SandboxState.RUNNING
    assert paginator.has_next is False
    assert paginator.next_token is None
    assert sandboxes2[0].sandbox_id == sandbox.sandbox_id


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
