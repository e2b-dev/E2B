import pytest

from e2b.sandbox.main import Sandbox


@pytest.mark.skip_debug()
def test_start(template):
    sbx = Sandbox(template, timeout=5)
    assert sbx.is_running()
