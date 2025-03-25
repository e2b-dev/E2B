import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_get_info(sandbox: Sandbox):
    info = sandbox.get_info()
    assert info.sandbox_id == sandbox.sandbox_id
