import random
import string

import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_list_sandboxes(sandbox: Sandbox):
    sandboxes = Sandbox.list()
    assert len(sandboxes.sandboxes) > 0
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]


@pytest.mark.skip_debug()
def test_list_sandboxes_with_filter(sandbox: Sandbox):
    unique_id = "".join(random.choices(string.ascii_letters, k=5))
    extra_sbx = Sandbox(metadata={"unique_id": unique_id})
    try:
        # There's an extra sandbox created by the test runner
        sandboxes = Sandbox.list(filters={"unique_id": unique_id})
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].metadata["unique_id"] == unique_id
    finally:
        extra_sbx.kill()

@pytest.mark.skip_debug()
def test_list_paused_sandboxes(sandbox: Sandbox):
    paused_sandbox = sandbox.pause()
    paused_sandbox_id = paused_sandbox.split("-")[0] + "-" + "00000000"
    sandboxes = Sandbox.list(state=["paused"])
    assert len(sandboxes.sandboxes) > 0
    assert paused_sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

@pytest.mark.skip_debug()
def test_list_running_sandboxes(sandbox: Sandbox):
    sandboxes = Sandbox.list(state=["running"])
    assert len(sandboxes.sandboxes) > 0
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

@pytest.mark.skip_debug()
def test_list_sandboxes_with_limit(sandbox: Sandbox):
    sandboxes = Sandbox.list(limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

@pytest.mark.skip_debug()
def test_paginate_running_sandboxes(sandbox: Sandbox):
    extra_sbx = Sandbox()
    # Check first page
    try:
        sandboxes = Sandbox.list(state=["running"], limit=1)
        assert len(sandboxes.sandboxes) == 1
        assert sandboxes.sandboxes[0].state == "running"
        assert sandboxes.has_more_items is True
        assert sandboxes.next_token is not None
        assert extra_sbx.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

        # Check second page
        sandboxes2 = Sandbox.list(state=["running"], next_token=sandboxes.next_token, limit=1)
        assert len(sandboxes2.sandboxes) == 1
        assert sandboxes2.sandboxes[0].state == "running"
        assert sandboxes2.has_more_items is False
        assert sandboxes2.next_token is None
        assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes2.sandboxes]
    finally:
        extra_sbx.kill()

@pytest.mark.skip_debug()
def test_paginate_paused_sandboxes(sandbox: Sandbox):
    # Pause the current sandbox
    sandbox.pause()

    # Create and pause a new sandbox
    extra_sbx = Sandbox()
    extra_sbx.pause()

    # Check first page
    sandboxes = Sandbox.list(state=["paused"], limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert sandboxes.sandboxes[0].state == "paused"
    assert sandboxes.has_more_items is True
    assert sandboxes.next_token is not None
    assert extra_sbx.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

    # Check second page
    sandboxes2 = Sandbox.list(state=["paused"], next_token=sandboxes.next_token, limit=1)
    assert len(sandboxes2.sandboxes) == 1
    assert sandboxes2.sandboxes[0].state == "paused"
    assert sandboxes2.has_more_items is False
    assert sandboxes2.next_token is None
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes2.sandboxes]

@pytest.mark.skip_debug()
def test_paginate_paused_and_running_sandboxes(sandbox: Sandbox):
    # Create and pause a new sandbox
    extra_sbx = Sandbox()
    extra_sbx.pause()

    # Check first page
    sandboxes = Sandbox.list(state=["paused", "running"], limit=1)
    assert len(sandboxes.sandboxes) == 1
    assert sandboxes.sandboxes[0].state == "paused"
    assert sandboxes.has_more_items is True
    assert sandboxes.next_token is not None
    assert extra_sbx.sandbox_id in [sbx.sandbox_id for sbx in sandboxes.sandboxes]

    # Check second page
    sandboxes2 = Sandbox.list(state=["paused", "running"], next_token=sandboxes.next_token, limit=1)
    assert len(sandboxes2.sandboxes) == 1
    assert sandboxes2.sandboxes[0].state == "running"
    assert sandboxes2.has_more_items is False
    assert sandboxes2.next_token is None
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes2.sandboxes]
