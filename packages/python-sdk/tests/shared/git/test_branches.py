def test_branches_lists_current_and_feature(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.commands.run(f'git -C "{repo_path}" branch feature')

    branches = git_sandbox.git.branches(repo_path)
    assert branches.current_branch == "main"
    assert "main" in branches.branches
    assert "feature" in branches.branches
