from unittest.mock import Mock

import pytest

from e2b_desktop.main import _VNCServer


def desktop_with_stream():
    desktop = Mock()
    desktop._display = ":0"
    desktop.get_host.return_value = "example.com"
    desktop._wait_and_verify.return_value = True

    stream = _VNCServer(desktop)
    stream._check_vnc_running = Mock(return_value=False)
    return desktop, stream


def started_vnc_command(desktop: Mock) -> str:
    commands = [call.args[0] for call in desktop.commands.run.call_args_list]
    return next(command for command in commands if command.startswith("x11vnc -bg"))


@pytest.mark.parametrize("cursor", ["shape", None])
def test_uses_cursor_shape_updates_by_default(cursor):
    desktop, stream = desktop_with_stream()

    if cursor is None:
        stream.start()
    else:
        stream.start(cursor=cursor)

    assert "-nocursorshape" not in started_vnc_command(desktop)


def test_composites_cursor_into_framebuffer_updates_for_spectators():
    desktop, stream = desktop_with_stream()

    stream.start(cursor="composite")

    assert " -nocursorshape " in started_vnc_command(desktop)
