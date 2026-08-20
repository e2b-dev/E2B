import pytest
from e2b import Sandbox


@pytest.mark.skip_debug()
@pytest.mark.timeout(60)
def test_snapshot(sandbox: Sandbox):
    assert sandbox.is_running()

    sandbox.pause()
    assert not sandbox.is_running()

    resumed_sandbox = sandbox.connect()
    assert sandbox.is_running()
    assert resumed_sandbox.is_running()
    assert resumed_sandbox.sandbox_id == sandbox.sandbox_id
