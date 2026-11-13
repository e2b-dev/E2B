from unittest.mock import Mock

import pytest
from e2b import CommandExitException, Sandbox as BaseSandbox, TimeoutException

from e2b_desktop import Sandbox


def desktop_with_commands():
    sandbox = Mock(spec=Sandbox)
    sandbox._last_xfce4_pid = None
    sandbox.commands.run.return_value.pid = 42
    return sandbox


def test_waits_for_xfce_desktop_session_before_startup_completes():
    sandbox = desktop_with_commands()
    sandbox._wait_and_verify.return_value = True

    Sandbox._start_xfce4(sandbox)

    sandbox._wait_and_verify.assert_called_once()
    command, _, timeout = sandbox._wait_and_verify.call_args.args
    assert "xfce4-session" in command
    assert timeout == 60


def test_fails_startup_when_xfce_desktop_session_never_becomes_ready():
    sandbox = desktop_with_commands()
    sandbox._wait_and_verify.return_value = False

    with pytest.raises(TimeoutException, match="Could not start XFCE"):
        Sandbox._start_xfce4(sandbox)


def test_kills_sandbox_when_desktop_session_fails_to_initialize(monkeypatch):
    sandbox = Mock(spec=Sandbox)
    sandbox.commands.run.side_effect = TimeoutException("Could not start Xvfb")
    monkeypatch.setattr(BaseSandbox, "create", Mock(return_value=sandbox))

    with pytest.raises(TimeoutException, match="Could not start Xvfb"):
        Sandbox.create()

    sandbox.kill.assert_called_once_with()


def test_waits_between_readiness_probes_that_exit_unsuccessfully(monkeypatch):
    sandbox = desktop_with_commands()
    sandbox.commands.run.side_effect = [
        CommandExitException(stderr="", stdout="", exit_code=1, error=None),
        Mock(exit_code=0),
    ]
    sleep = Mock()
    monkeypatch.setattr("e2b_desktop.main.time.sleep", sleep)

    assert Sandbox._wait_and_verify(
        sandbox, "readiness-probe", lambda result: result.exit_code == 0
    )

    sleep.assert_called_once_with(0.5)
    assert sandbox.commands.run.call_count == 2
