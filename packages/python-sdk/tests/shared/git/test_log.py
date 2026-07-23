from e2b.sandbox._git import build_log_args, parse_git_log
from e2b.sandbox._git.types import GitCommit

_FORMAT = "log"
_PRETTY = "--pretty=format:%H%x1f%an%x1f%ae%x1f%aI%x1f%s"


def test_build_log_args_default():
    assert build_log_args() == [_FORMAT, _PRETTY]


def test_build_log_args_with_max_count():
    assert build_log_args(5) == [_FORMAT, _PRETTY, "-n", "5"]


def test_parse_git_log_parses_commits():
    output = (
        "abc123\x1fAda Lovelace\x1fada@example.com\x1f2026-07-01T10:00:00+00:00\x1fInitial commit\n"
        "def456\x1fAlan Turing\x1falan@example.com\x1f2026-07-02T12:30:00+00:00\x1fAdd feature"
    )
    commits = parse_git_log(output)

    assert commits == [
        GitCommit(
            hash="abc123",
            author_name="Ada Lovelace",
            author_email="ada@example.com",
            date="2026-07-01T10:00:00+00:00",
            message="Initial commit",
        ),
        GitCommit(
            hash="def456",
            author_name="Alan Turing",
            author_email="alan@example.com",
            date="2026-07-02T12:30:00+00:00",
            message="Add feature",
        ),
    ]


def test_parse_git_log_empty_output():
    assert parse_git_log("") == []


def test_parse_git_log_skips_malformed_lines():
    assert parse_git_log("no-separators-here") == []
