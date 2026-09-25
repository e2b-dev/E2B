from typing import Any, Callable, List, cast

import pytest

from e2b.exceptions import GitAuthException, GitUpstreamException
from e2b.sandbox._git import build_git_command, build_remote_set_url_args
from e2b.sandbox.commands.command_handle import (
    CommandExitException,
    CommandResult,
)
from e2b.sandbox_async.git import Git as AsyncGit
from e2b.sandbox_sync.git import Git as SyncGit

REMOTE_URL = "https://github.com/e2b-dev/e2b.git"


def git_exit_failure(stderr: str) -> CommandExitException:
    return CommandExitException(stdout="", stderr=stderr, exit_code=128, error=None)


def fake_run(
    failure: CommandExitException, calls: List[str]
) -> Callable[..., CommandResult]:
    """
    Fake `Commands.run` standing in for the sandbox: every git invocation is
    recorded, the push/pull itself fails with the given error, and the remote
    bookkeeping around it (`remote get-url` / `remote set-url`) succeeds.
    """

    def run(cmd: str, **_: Any) -> CommandResult:
        calls.append(cmd)
        tokens = cmd.replace("'", "").split()
        if "push" in tokens or "pull" in tokens:
            raise failure
        if "get-url" in tokens:
            return CommandResult(
                stdout=f"{REMOTE_URL}\n", stderr="", exit_code=0, error=None
            )
        return CommandResult(stdout="", stderr="", exit_code=0, error=None)

    return run


class FakeCommands:
    """Sync command runner recording every git invocation."""

    def __init__(self, failure: CommandExitException) -> None:
        self.calls: List[str] = []
        self.run = fake_run(failure, self.calls)


class FakeAsyncCommands:
    """Async command runner recording every git invocation."""

    def __init__(self, failure: CommandExitException) -> None:
        self.calls: List[str] = []
        run = fake_run(failure, self.calls)

        async def run_async(cmd: str, **kwargs: Any) -> CommandResult:
            return run(cmd, **kwargs)

        self.run = run_async


def test_push_without_credentials_maps_auth_failure():
    commands = FakeCommands(
        git_exit_failure(f"fatal: Authentication failed for '{REMOTE_URL}/'")
    )
    git = SyncGit(cast(Any, commands))

    with pytest.raises(GitAuthException):
        git.push("/repo", remote="origin")


def test_push_with_credentials_maps_auth_failure():
    commands = FakeCommands(
        git_exit_failure(f"fatal: Authentication failed for '{REMOTE_URL}/'")
    )
    git = SyncGit(cast(Any, commands))

    with pytest.raises(GitAuthException):
        git.push("/repo", remote="origin", username="user", password="expired-token")

    # The credentials temporarily embedded in the remote URL must be stripped
    # again even when the push fails.
    assert commands.calls[-1] == build_git_command(
        build_remote_set_url_args("origin", REMOTE_URL), "/repo"
    )


def test_pull_with_credentials_maps_auth_failure():
    commands = FakeCommands(
        git_exit_failure(f"fatal: Authentication failed for '{REMOTE_URL}/'")
    )
    git = SyncGit(cast(Any, commands))

    with pytest.raises(GitAuthException):
        git.pull(
            "/repo",
            remote="origin",
            branch="main",
            username="user",
            password="expired-token",
        )


def test_push_with_credentials_maps_missing_upstream():
    commands = FakeCommands(
        git_exit_failure(
            "fatal: The current branch main has no upstream branch.\n"
            "To push the current branch and set the remote as upstream, use\n\n"
            "    git push --set-upstream origin main"
        )
    )
    git = SyncGit(cast(Any, commands))

    with pytest.raises(GitUpstreamException):
        git.push(
            "/repo",
            remote="origin",
            set_upstream=False,
            username="user",
            password="token",
        )


def test_pull_with_credentials_maps_missing_upstream():
    commands = FakeCommands(
        git_exit_failure(
            "There is no tracking information for the current branch.\n"
            "Please specify which branch you want to merge with."
        )
    )
    git = SyncGit(cast(Any, commands))

    with pytest.raises(GitUpstreamException):
        git.pull("/repo", remote="origin", username="user", password="token")


async def test_async_push_with_credentials_maps_auth_failure():
    commands = FakeAsyncCommands(
        git_exit_failure(f"fatal: Authentication failed for '{REMOTE_URL}/'")
    )
    git = AsyncGit(cast(Any, commands))

    with pytest.raises(GitAuthException):
        await git.push(
            "/repo", remote="origin", username="user", password="expired-token"
        )


async def test_async_pull_with_credentials_maps_auth_failure():
    commands = FakeAsyncCommands(
        git_exit_failure(f"fatal: Authentication failed for '{REMOTE_URL}/'")
    )
    git = AsyncGit(cast(Any, commands))

    with pytest.raises(GitAuthException):
        await git.pull(
            "/repo",
            remote="origin",
            branch="main",
            username="user",
            password="expired-token",
        )
