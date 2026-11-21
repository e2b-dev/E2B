import pytest

from e2b.sandbox._git.parse import parse_git_status
from e2b.sandbox.commands.command_handle import CommandResult
from e2b.sandbox_sync.git import Git


class StubCommands:
    """Command runner that replays recorded `git status` output."""

    def __init__(self, stdout: str) -> None:
        self._stdout = stdout

    def run(self, cmd, **kwargs) -> CommandResult:
        return CommandResult(stdout=self._stdout, stderr="", exit_code=0, error=None)


class TestQuotedPathNames:
    @pytest.mark.parametrize(
        ("line", "expected"),
        [
            # Captured from `git -c core.quotePath=true status --porcelain=1`:
            # every path that is not plain printable ASCII is C-quoted.
            ('?? "caf\\303\\251.txt"', "café.txt"),
            ('?? "uni\\344\\270\\255\\346\\226\\207.txt"', "uni中文.txt"),
            ('?? "sp ace dir/"', "sp ace dir/"),
            ('?? "tab\\there.txt"', "tab\there.txt"),
            ('?? "quote\\"d.txt"', 'quote"d.txt'),
            ('?? "back\\\\slash.txt"', "back\\slash.txt"),
            # Nothing to decode.
            ("?? plain.txt", "plain.txt"),
        ],
    )
    def test_should_decode_a_quoted_untracked_path(self, line, expected):
        status = parse_git_status(f"## main\n{line}\n")

        assert [entry.name for entry in status.file_status] == [expected]

    @pytest.mark.parametrize(
        ("line", "expected_from", "expected_name"),
        [
            (
                'R  plain.txt -> "renamed plain.txt"',
                "plain.txt",
                "renamed plain.txt",
            ),
            (
                'R  "caf\\303\\251.txt" -> "caf\\303\\251-2.txt"',
                "café.txt",
                "café-2.txt",
            ),
            # A quoted path may itself contain the ` -> ` separator.
            (
                'R  "a -> b.txt" -> "c -> d.txt"',
                "a -> b.txt",
                "c -> d.txt",
            ),
            ("R  old.txt -> new.txt", "old.txt", "new.txt"),
        ],
    )
    def test_should_decode_a_quoted_rename(self, line, expected_from, expected_name):
        status = parse_git_status(f"## main\n{line}\n")

        [entry] = status.file_status
        assert entry.renamed_from == expected_from
        assert entry.name == expected_name

    def test_should_decode_a_quoted_modified_path(self):
        status = parse_git_status('## main\n M "caf\\303\\251.txt"\n')

        [entry] = status.file_status
        assert entry.name == "café.txt"
        assert entry.status == "modified"


def test_status_reports_unquoted_path_names():
    """`sandbox.git.status()` returns the paths as they are on disk."""
    porcelain = (
        "## main\n"
        'R  plain.txt -> "renamed plain.txt"\n'
        '?? "caf\\303\\251.txt"\n'
        '?? "sp ace dir/"\n'
    )

    status = Git(StubCommands(porcelain)).status("/home/user/repo")

    assert [entry.name for entry in status.file_status] == [
        "renamed plain.txt",
        "café.txt",
        "sp ace dir/",
    ]
    assert status.file_status[0].renamed_from == "plain.txt"
    assert status.untracked_count == 2
