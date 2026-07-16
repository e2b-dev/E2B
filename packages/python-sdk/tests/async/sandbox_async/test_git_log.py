import pytest
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.exceptions import InvalidArgumentException
from e2b.sandbox_async.git import Git

class MockCommandsAsync:
    def __init__(self, run_func):
        self._run_func = run_func
        
    async def run(self, *args, **kwargs):
        return self._run_func(*args, **kwargs)

@pytest.mark.asyncio
async def test_git_log_throws_invalid_max_count():
    def mock_run(*args, **kwargs):
        raise Exception("should not be called")
        
    git = Git(MockCommandsAsync(mock_run))
    with pytest.raises(InvalidArgumentException):
        await git.log("/repo", max_count=0)
    with pytest.raises(InvalidArgumentException):
        await git.log("/repo", max_count=-5)

@pytest.mark.asyncio
async def test_git_log_unborn_branch():
    def mock_run(*args, **kwargs):
        raise CommandExitException(
            stderr="fatal: your current branch 'main' does not have any commits yet\n",
            stdout="",
            exit_code=128,
            error="Process exited with code 128"
        )
        
    git = Git(MockCommandsAsync(mock_run))
    commits = await git.log("/repo")
    assert commits == []
