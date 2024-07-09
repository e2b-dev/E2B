import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_list_sandboxes(sandbox: Sandbox):
    sandboxes = Sandbox.list()
    assert len(sandboxes) > 0
    assert sandbox.sandbox_id in [sbx.sandbox_id for sbx in sandboxes]
