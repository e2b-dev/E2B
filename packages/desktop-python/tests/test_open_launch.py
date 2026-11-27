import subprocess
import sys

import pytest

from e2b_desktop import Sandbox

# Commands run in the sandbox through `/bin/bash -l -c <cmd>`. Run the command
# the SDK builds through bash with `xdg-open` / `gtk-launch` replaced by a
# function that prints each argument it receives, one per line.
pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="needs bash")


def _argv_seen_by(program: str, command: str) -> list[str]:
    stub = f"{program}() {{ printf '%s\\n' \"$@\"; }}; "
    out = subprocess.run(
        ["bash", "-c", stub + command], capture_output=True, text=True, check=True
    ).stdout
    return [line for line in out.split("\n") if line]


class _Handle:
    def disconnect(self):
        pass


class _RecordingCommands:
    def __init__(self):
        self.commands: list[str] = []

    def run(self, cmd, **kwargs):
        self.commands.append(cmd)
        return _Handle()


def _recording_sandbox() -> tuple[Sandbox, _RecordingCommands]:
    class _FakeSandbox(Sandbox):
        @property
        def commands(self):
            return self._fake_commands

    sandbox = _FakeSandbox.__new__(_FakeSandbox)
    sandbox._fake_commands = _RecordingCommands()
    return sandbox, sandbox._fake_commands


def test_open_passes_a_url_with_a_query_string_as_one_argument():
    sandbox, commands = _recording_sandbox()
    url = "https://example.com/search?q=e2b&page=2#results"

    sandbox.open(url)

    assert len(commands.commands) == 1
    assert _argv_seen_by("xdg-open", commands.commands[0]) == [url]


def test_open_passes_a_file_path_with_spaces_and_quotes_as_one_argument():
    sandbox, commands = _recording_sandbox()
    path = "/home/user/Q3 report (Bob's copy).pdf"

    sandbox.open(path)

    assert _argv_seen_by("xdg-open", commands.commands[0]) == [path]


def test_launch_passes_the_application_and_the_uri_as_separate_arguments():
    sandbox, commands = _recording_sandbox()
    uri = "https://example.com/?a=1&b=2"

    sandbox.launch("google-chrome", uri)

    assert _argv_seen_by("gtk-launch", commands.commands[0]) == ["google-chrome", uri]


def test_launch_without_a_uri_passes_only_the_application():
    sandbox, commands = _recording_sandbox()

    sandbox.launch("google-chrome")

    assert _argv_seen_by("gtk-launch", commands.commands[0]) == ["google-chrome"]
