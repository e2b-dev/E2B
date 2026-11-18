from unittest.mock import Mock

from e2b import CommandExitException

from e2b_desktop import Sandbox
from e2b_desktop.main import _VNCServer


def stopped_desktop():
    desktop = Mock(spec=Sandbox)
    desktop._display = ":0"
    desktop.get_host.side_effect = lambda port: f"{port}-sbx.e2b.app"
    desktop._wait_and_verify.return_value = True

    def run(cmd, **kwargs):
        if cmd == "pgrep -x x11vnc":
            raise CommandExitException(stderr="", stdout="", exit_code=1, error=None)
        return Mock(stdout="")

    desktop.commands.run.side_effect = run
    return desktop


def commands(desktop):
    return [call.args[0] for call in desktop.commands.run.call_args_list]


def test_restart_with_auth_still_enabled_uses_a_fresh_password():
    desktop = stopped_desktop()
    stream = _VNCServer(desktop)

    stream.start(require_auth=True)
    first_key = stream.get_auth_key()
    stream.stop()
    desktop.commands.run.reset_mock()

    # require_auth stays enabled from the first start()
    stream.start()

    key = stream.get_auth_key()
    assert key and key != first_key
    assert f"x11vnc -storepasswd {key} ~/.vnc/passwd" in commands(desktop)
    assert not any("-storepasswd None" in cmd for cmd in commands(desktop))
    assert any("-usepw" in cmd for cmd in commands(desktop))


def test_start_without_auth_has_no_password():
    desktop = stopped_desktop()
    stream = _VNCServer(desktop)

    stream.start()

    assert not any("-storepasswd" in cmd for cmd in commands(desktop))
    assert any("-nopw" in cmd for cmd in commands(desktop))
