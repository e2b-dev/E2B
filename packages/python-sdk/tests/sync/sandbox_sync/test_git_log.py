from typing import Any
import pytest
from e2b.sandbox._git.parse import parse_git_log
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.sandbox_sync.git import Git

def test_parse_git_log_empty():
    assert parse_git_log("") == []
    assert parse_git_log("   \n  ") == []

def test_parse_git_log_formatted():
    stdout = "a1b2c3d4e5f6\x1fAlice Developer\x1falice@example.com\x1f2026-07-16T10:00:00+00:00\x1ffeat: add feature X\n" \
             "f6e5d4c3b2a1\x1fBob Coder\x1fbob@example.com\x1f2026-07-15T15:30:00+00:00\x1ffix: resolve critical bug with spaces"
    commits = parse_git_log(stdout)
    assert len(commits) == 2
    assert commits[0].hash == "a1b2c3d4e5f6"
    assert commits[0].author_name == "Alice Developer"
    assert commits[0].message == "feat: add feature X"
    assert commits[1].hash == "f6e5d4c3b2a1"

class MockCommands:
    def __init__(self, run_func):
        self._run_func = run_func
        
    def run(self, *args, **kwargs):
        return self._run_func(*args, **kwargs)

def test_git_log_throws_invalid_max_count():
    def mock_run(*args, **kwargs):
        raise Exception("should not be called")
        
    git = Git(MockCommands(mock_run))
    with pytest.raises(InvalidArgumentException):
        git.log("/repo", max_count=0)
    with pytest.raises(InvalidArgumentException):
        git.log("/repo", max_count=-5)

def test_git_log_unborn_branch():
    def mock_run(*args, **kwargs):
        raise CommandExitException(
            stderr="fatal: your current branch 'main' does not have any commits yet\n",
            stdout="",
            exit_code=128,
            error="Process exited with code 128"
        )
        
    git = Git(MockCommands(mock_run))
    assert git.log("/repo") == []
