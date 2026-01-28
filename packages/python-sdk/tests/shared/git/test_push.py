import pytest

from e2b.exceptions import InvalidArgumentException


@pytest.mark.skip_debug()
def test_push_updates_remote(git_sandbox, git_repo_with_commit, git_daemon):
    repo_path = git_repo_with_commit
    remote_url = git_daemon["remote_url"]

    git_sandbox.git.remote_add(repo_path, "origin", remote_url)
    git_sandbox.git.push(
        repo_path,
        remote="origin",
        branch="main",
        set_upstream=True,
    )

    message = git_sandbox.commands.run(
        f'git --git-dir="{git_daemon["remote_path"]}" log -1 --pretty=%B'
    ).stdout.strip()
    assert message == "Initial commit"


@pytest.mark.skip_debug()
def test_push_without_upstream_warns(git_sandbox, git_repo_with_commit, git_daemon):
    repo_path = git_repo_with_commit
    remote_url = git_daemon["remote_url"]

    git_sandbox.git.remote_add(repo_path, "origin", remote_url)

    with pytest.raises(InvalidArgumentException) as exc:
        git_sandbox.git.push(repo_path, set_upstream=False)

    assert "no upstream branch is configured" in str(exc.value).lower()
