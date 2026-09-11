from unittest.mock import Mock

import pytest
from e2b import (
    CommandExitException,
    Sandbox as BaseSandbox,
    SandboxException,
    TimeoutException,
)

from e2b_desktop import DesktopStartupException, Sandbox


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


@pytest.mark.parametrize("killed", [True, False])
def test_preserves_startup_error_when_cleanup_succeeds(monkeypatch, killed):
    startup_error = TimeoutException("Could not start Xvfb")
    sandbox = Mock(spec=Sandbox)
    sandbox.commands.run.side_effect = startup_error
    sandbox.kill.return_value = killed
    monkeypatch.setattr(BaseSandbox, "create", Mock(return_value=sandbox))

    with pytest.raises(TimeoutException) as caught:
        Sandbox.create()

    assert caught.value is startup_error
    sandbox.kill.assert_called_once_with()


def test_retains_allocation_and_both_failures_when_startup_cleanup_fails(monkeypatch):
    startup_error = TimeoutException("Could not start Xvfb")
    cleanup_error = RuntimeError("Synthetic cleanup transport failure")
    sandbox = Mock(spec=Sandbox)
    sandbox.sandbox_id = "synthetic-owned-sandbox"
    sandbox.commands.run.side_effect = startup_error
    sandbox.kill.side_effect = cleanup_error
    monkeypatch.setattr(BaseSandbox, "create", Mock(return_value=sandbox))

    with pytest.raises(DesktopStartupException) as caught:
        Sandbox.create()

    assert isinstance(caught.value, SandboxException)
    assert caught.value.sandbox_id == sandbox.sandbox_id
    assert sandbox.sandbox_id in str(caught.value)
    assert f"Sandbox.kill('{sandbox.sandbox_id}')" in str(caught.value)
    assert str(startup_error) not in str(caught.value)
    assert str(cleanup_error) not in str(caught.value)
    assert caught.value.__cause__ is startup_error
    assert caught.value.__suppress_context__ is True
    assert caught.value.cleanup_error is cleanup_error
    sandbox.kill.assert_called_once_with()


def test_constructed_startup_exception_retains_its_explicit_cause():
    startup_error = TimeoutException("Synthetic startup failure")
    cleanup_error = RuntimeError("Synthetic cleanup failure")

    error = DesktopStartupException(
        "synthetic-owned-sandbox", startup_error, cleanup_error
    )

    assert error.__cause__ is startup_error
    assert error.__suppress_context__ is True
    assert error.cleanup_error is cleanup_error


def test_returns_successfully_started_sandbox_without_cleanup(monkeypatch):
    sandbox = Mock(spec=Sandbox)
    sandbox._wait_and_verify.return_value = True
    monkeypatch.setattr(BaseSandbox, "create", Mock(return_value=sandbox))

    assert Sandbox.create() is sandbox

    sandbox._start_xfce4.assert_called_once_with()
    sandbox.kill.assert_not_called()


def test_preserves_allocation_failure_before_desktop_exists(monkeypatch):
    allocation_error = RuntimeError("Synthetic allocation failure")
    monkeypatch.setattr(BaseSandbox, "create", Mock(side_effect=allocation_error))

    with pytest.raises(RuntimeError) as caught:
        Sandbox.create()

    assert caught.value is allocation_error


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
