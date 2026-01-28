import pytest

from e2b.exceptions import InvalidArgumentException


@pytest.mark.skip_debug()
def test_pull_updates_clone(
    git_sandbox, git_repo_with_commit, git_daemon, git_base_dir, git_author
):
    repo_path = git_repo_with_commit
    remote_url = git_daemon["remote_url"]
    clone_path = f"{git_base_dir}/clone"

    git_sandbox.git.remote_add(repo_path, "origin", remote_url)
    git_sandbox.git.push(
        repo_path,
        remote="origin",
        branch="main",
        set_upstream=True,
    )
    git_sandbox.git.clone(remote_url, clone_path)

    git_sandbox.files.write(f"{repo_path}/README.md", "hello\nmore\n")
    author_name, author_email = git_author
    git_sandbox.git.add(repo_path, all=True)
    git_sandbox.git.commit(
        repo_path,
        message="Update README",
        author_name=author_name,
        author_email=author_email,
    )
    git_sandbox.git.push(repo_path)

    git_sandbox.git.pull(clone_path)
    contents = git_sandbox.files.read(f"{clone_path}/README.md")
    assert "more" in contents


@pytest.mark.skip_debug()
def test_pull_without_upstream_warns(git_sandbox, git_repo_with_commit, git_daemon):
    repo_path = git_repo_with_commit
    remote_url = git_daemon["remote_url"]

    git_sandbox.git.remote_add(repo_path, "origin", remote_url)

    with pytest.raises(InvalidArgumentException) as exc:
        git_sandbox.git.pull(repo_path)

    assert "no upstream branch is configured" in str(exc.value).lower()
