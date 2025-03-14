import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_kill(sandbox: Sandbox):
    sandbox.kill()

    list = Sandbox.list()
    assert sandbox.sandbox_id not in [s.sandbox_id for s in list.sandboxes]
