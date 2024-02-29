import pytest

from e2b import Sandbox, SandboxException


def test_kill_sandbox():
    s = Sandbox()
    Sandbox.kill(s.id)

    with pytest.raises(SandboxException):
        s._refresh()

    s.close()
