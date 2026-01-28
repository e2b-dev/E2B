import pytest


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
