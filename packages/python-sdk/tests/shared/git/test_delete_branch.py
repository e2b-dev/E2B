def test_delete_branch_removes_branch(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.commands.run(f'git -C "{repo_path}" branch feature')
    git_sandbox.git.delete_branch(repo_path, "feature", force=True)

    branch = git_sandbox.commands.run(
        f'git -C "{repo_path}" branch --list feature'
    ).stdout.strip()
    assert branch == ""
