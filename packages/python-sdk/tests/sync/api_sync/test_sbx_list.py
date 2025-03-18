import random
import string

import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_list_sandboxes(sandbox: Sandbox):
    sandboxes = Sandbox.list()
    assert len(sandboxes) > 0
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]


@pytest.mark.skip_debug()
def test_list_sandboxes_with_filter(sandbox: Sandbox):
    unique_id = "".join(random.choices(string.ascii_letters, k=5))
    Sandbox(metadata={"unique_id": unique_id})
    sandboxes = Sandbox.list(filters={"unique_id": unique_id})
    assert len(sandboxes) == 1
    assert sandboxes[0].metadata["unique_id"] == unique_id
