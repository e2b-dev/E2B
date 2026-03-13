import pytest

from e2b.exceptions import GitAuthException
from e2b.sandbox._git.auth import is_auth_failure
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


def test_is_auth_failure_detects_ssh_publickey_errors():
    err = _command_exit("git@github.com: Permission denied (publickey).")

    assert is_auth_failure(err) is True


def test_clone_preserves_path_permission_failures():
    err = _command_exit(
        "fatal: could not create work tree dir '/home/workspace': Permission denied"
    )

    class FailingCommands:
        def run(self, *args, **kwargs):
            raise err

    git = Git(FailingCommands())

    with pytest.raises(CommandExitException) as exc:
        git.clone("https://github.com/e2b-dev/e2b.git", "/home/workspace")

    assert exc.value is err
    assert not isinstance(exc.value, GitAuthException)
