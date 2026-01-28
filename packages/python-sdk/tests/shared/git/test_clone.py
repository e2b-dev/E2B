def test_clone_fetches_repo(git_sandbox, git_repo_with_commit, git_daemon, git_base_dir):
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
    contents = git_sandbox.files.read(f"{clone_path}/README.md")
    assert "hello" in contents
