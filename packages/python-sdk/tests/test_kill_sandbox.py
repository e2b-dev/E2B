import pytest

from e2b import Sandbox
from e2b.api import exceptions


def test_kill_sandbox():
    s = Sandbox()
    with pytest.raises(exceptions.ApiException):
        Sandbox.kill(s.id)
        s._refresh()
