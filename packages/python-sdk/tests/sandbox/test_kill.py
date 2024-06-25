import pytest

from e2b.sandbox.main import Sandbox


def test_kill(sandbox: Sandbox):
    sandbox.kill()
    with pytest.raises(Exception):
        sandbox.is_running()
