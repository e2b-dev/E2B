import pytest

from e2b.exceptions import GitAuthException, GitPermissionException
from e2b.sandbox._git.auth import (
    build_permission_error_message,
    is_auth_failure,
    is_permission_failure,
)
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.sandbox_sync.git import Git


def _command_exit(stderr: str):
    return CommandExitException(
        stderr=stderr,
        stdout="",
        exit_code=128,
        error=stderr,
    )


def test_is_auth_failure_ignores_filesystem_permission_errors():
    err = _command_exit(
        "fatal: could not create work tree dir '/home/workspace': Permission denied"
    )

    assert is_auth_failure(err) is False


def test_is_permission_failure_detects_git_filesystem_errors():
    err = _command_exit("error: cannot open .git/FETCH_HEAD: Permission denied")

    assert is_permission_failure(err) is True


def test_is_auth_failure_detects_ssh_publickey_errors():
    err = _command_exit("git@github.com: Permission denied (publickey).")

    assert is_auth_failure(err) is True


class FailingCommands:
    def __init__(self, err: CommandExitException):
        self.err = err

    def run(self, *args, **kwargs):
        raise self.err


def test_clone_raises_permission_exception_for_path_permission_failures():
    err = _command_exit(
        "fatal: could not create work tree dir '/home/workspace': Permission denied"
    )
    git = Git(FailingCommands(err))

    with pytest.raises(GitPermissionException) as exc:
        git.clone("https://github.com/e2b-dev/e2b.git", "/home/workspace")

    assert str(exc.value) == build_permission_error_message("clone")
    assert not isinstance(exc.value, GitAuthException)


def test_push_raises_permission_exception_for_repository_write_failures():
    err = _command_exit("error: unable to create '.git/index.lock': Permission denied")
    git = Git(FailingCommands(err))

    with pytest.raises(GitPermissionException) as exc:
        git.push("/repo", remote="origin", branch="main")

    assert str(exc.value) == build_permission_error_message("push")


def test_pull_raises_permission_exception_for_repository_write_failures():
    err = _command_exit("error: cannot open .git/FETCH_HEAD: Permission denied")
    git = Git(FailingCommands(err))

    with pytest.raises(GitPermissionException) as exc:
        git.pull("/repo", remote="origin", branch="main")

    assert str(exc.value) == build_permission_error_message("pull")
