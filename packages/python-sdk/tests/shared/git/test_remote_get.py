import pytest


@pytest.mark.skip_debug()
def test_remote_get_returns_url(git_sandbox, git_repo, git_daemon):
    repo_path = git_repo

    missing_url = git_sandbox.git.remote_get(repo_path, "origin")
    assert missing_url is None

    remote_url = git_daemon["remote_url"]
    git_sandbox.git.remote_add(repo_path, "origin", remote_url)
    current_url = git_sandbox.git.remote_get(repo_path, "origin")
    assert current_url == remote_url
