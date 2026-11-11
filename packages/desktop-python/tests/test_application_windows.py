from e2b import CommandExitException

from e2b_desktop import Sandbox


class _FakeCommands:
    def __init__(self, stdout: str = "", exit_code: int = 0):
        self._stdout = stdout
        self._exit_code = exit_code

    def run(self, command, **kwargs):
        if self._exit_code != 0:
            raise CommandExitException(
                stdout=self._stdout,
                stderr="",
                exit_code=self._exit_code,
                error=None,
            )

        class _Result:
            stdout = self._stdout
            exit_code = self._exit_code

        return _Result()


def _sandbox_with_commands(commands: _FakeCommands) -> Sandbox:
    class _FakeSandbox(Sandbox):
        @property
        def commands(self):
            return self._fake_commands

    sandbox = _FakeSandbox.__new__(_FakeSandbox)
    sandbox._fake_commands = commands
    return sandbox


def test_no_matching_window_exit_code_1_yields_an_empty_list():
    # Real xdotool behavior: a search with no match exits with status 1 and
    # prints nothing on stdout.
    sandbox = _sandbox_with_commands(_FakeCommands(stdout="", exit_code=1))
    assert sandbox.get_application_windows("firefox") == []


def test_no_match_with_whitespace_only_stdout_yields_an_empty_list():
    sandbox = _sandbox_with_commands(_FakeCommands(stdout="\n  \n", exit_code=1))
    assert sandbox.get_application_windows("firefox") == []


def test_one_window_id_per_non_empty_line():
    sandbox = _sandbox_with_commands(_FakeCommands(stdout="65011712\n65011744\n"))
    assert sandbox.get_application_windows("firefox") == ["65011712", "65011744"]


def test_blank_lines_between_ids_are_dropped():
    sandbox = _sandbox_with_commands(_FakeCommands(stdout="65011712\n\n 65011744 \n"))
    assert sandbox.get_application_windows("firefox") == ["65011712", "65011744"]


def test_no_match_on_a_non_search_failure_exit_code_still_raises():
    sandbox = _sandbox_with_commands(_FakeCommands(stdout="", exit_code=2))
    try:
        sandbox.get_application_windows("firefox")
    except CommandExitException as e:
        assert e.exit_code == 2
    else:
        raise AssertionError("expected CommandExitException to propagate")
