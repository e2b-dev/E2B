from e2b_desktop import Sandbox


class _FakeCommands:
    def __init__(self, stdout: str):
        self._stdout = stdout

    def run(self, command, **kwargs):
        out = self._stdout

        class _Result:
            stdout = out
            exit_code = 0

        return _Result()


def _sandbox_with_stdout(stdout: str) -> Sandbox:
    class _FakeSandbox(Sandbox):
        @property
        def commands(self):
            return self._fake_commands

    sandbox = _FakeSandbox.__new__(_FakeSandbox)
    sandbox._fake_commands = _FakeCommands(stdout)
    return sandbox


def test_no_matching_window_yields_an_empty_list():
    sandbox = _sandbox_with_stdout("")
    assert sandbox.get_application_windows("firefox") == []


def test_whitespace_only_output_yields_an_empty_list():
    sandbox = _sandbox_with_stdout("\n  \n")
    assert sandbox.get_application_windows("firefox") == []


def test_one_window_id_per_non_empty_line():
    sandbox = _sandbox_with_stdout("65011712\n65011744\n")
    assert sandbox.get_application_windows("firefox") == ["65011712", "65011744"]


def test_blank_lines_between_ids_are_dropped():
    sandbox = _sandbox_with_stdout("65011712\n\n 65011744 \n")
    assert sandbox.get_application_windows("firefox") == ["65011712", "65011744"]
