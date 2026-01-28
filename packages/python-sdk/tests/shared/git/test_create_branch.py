def test_create_branch_creates_branch(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.git.create_branch(repo_path, "feature")

    branches = git_sandbox.git.branches(repo_path)
    assert "feature" in branches.branches
    assert branches.current_branch == "feature"
