import os
import uuid
from datetime import timedelta

import pytest

from e2b import Sandbox, SandboxQuery, SandboxState

# Sandbox list ordering and the started_after/template filters require API
# support that is not yet deployed to production (only E2B_DOMAIN-configured
# environments like staging).
skip_without_list_filters = pytest.mark.skipif(
    not os.getenv("E2B_DOMAIN"),
    reason="sandbox list order/started_after/template require staging API",
)


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
    assert any(
        s.sandbox_id == sandbox.sandbox_id and s.state == SandboxState.PAUSED
        for s in sandboxes
    )


@pytest.mark.skip_debug()
def test_paginate_running_sandboxes(
    sandbox: Sandbox, sandbox_factory, sandbox_test_id: str
):
    # Create two sandboxes
    extra_sbx = sandbox_factory(metadata={"sandbox_test_id": sandbox_test_id})

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


@pytest.mark.skip_debug()
def test_paginate_paused_sandboxes(
    sandbox: Sandbox, sandbox_factory, sandbox_test_id: str
):
    sandbox.beta_pause()

    # create another paused sandbox
    extra_sbx = sandbox_factory(metadata={"sandbox_test_id": sandbox_test_id})
    extra_sbx.beta_pause()

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
    assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id

    # Get second page
    sandboxes = paginator.next_items()

    # Check second page
    assert len(sandboxes) == 1
    assert sandboxes[0].state == SandboxState.PAUSED
    assert paginator.has_next is False
    assert paginator.next_token is None
    assert sandboxes[0].sandbox_id == sandbox.sandbox_id


@pytest.mark.skip_debug()
def test_paginate_running_and_paused_sandboxes(
    sandbox: Sandbox, sandbox_factory, sandbox_test_id: str
):
    # Create extra paused sandbox
    extra_sbx = sandbox_factory(metadata={"sandbox_test_id": sandbox_test_id})
    extra_sbx.beta_pause()

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
    assert sandboxes[0].sandbox_id == extra_sbx.sandbox_id

    # Get second page
    sandboxes = paginator.next_items()

    # Check second page
    assert len(sandboxes) == 1
    assert sandboxes[0].state == SandboxState.RUNNING
    assert paginator.has_next is False
    assert paginator.next_token is None
    assert sandboxes[0].sandbox_id == sandbox.sandbox_id


@pytest.mark.skip_debug()
@skip_without_list_filters
def test_list_sandboxes_with_order(
    sandbox: Sandbox, sandbox_factory, sandbox_test_id: str
):
    extra_sbx = sandbox_factory(metadata={"sandbox_test_id": sandbox_test_id})

    paginator = Sandbox.list(
        query=SandboxQuery(metadata={"sandbox_test_id": sandbox_test_id}),
        order="asc",
    )
    asc = paginator.next_items()
    assert len(asc) >= 2
    assert asc[0].sandbox_id == sandbox.sandbox_id
    assert asc[-1].sandbox_id == extra_sbx.sandbox_id

    paginator = Sandbox.list(
        query=SandboxQuery(metadata={"sandbox_test_id": sandbox_test_id}),
        order="desc",
    )
    desc = paginator.next_items()
    assert len(desc) >= 2
    assert desc[0].sandbox_id == extra_sbx.sandbox_id
    assert desc[-1].sandbox_id == sandbox.sandbox_id


@pytest.mark.skip_debug()
@skip_without_list_filters
def test_list_sandboxes_started_after(sandbox: Sandbox, sandbox_test_id: str):
    info = sandbox.get_info()

    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            started_after=info.started_at,
        )
    )
    sandboxes = paginator.next_items()
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]

    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            started_after=info.started_at + timedelta(seconds=1),
        )
    )
    later_sandboxes = paginator.next_items()
    assert sandbox.sandbox_id not in [sbx.sandbox_id for sbx in later_sandboxes]


@pytest.mark.skip_debug()
@skip_without_list_filters
def test_list_sandboxes_with_template_filter(sandbox: Sandbox, sandbox_test_id: str):
    info = sandbox.get_info()

    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            template=info.template_id,
        )
    )
    sandboxes = paginator.next_items()
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]

    paginator = Sandbox.list(
        query=SandboxQuery(
            metadata={"sandbox_test_id": sandbox_test_id},
            template="unknown-template",
        )
    )
    unknown_sandboxes = paginator.next_items()
    assert len(unknown_sandboxes) == 0


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
