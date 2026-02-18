import pytest


@pytest.mark.skip_debug()
def test_branches_lists_current_and_feature(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.commands.run(f'git -C "{repo_path}" branch feature')

    branches = git_sandbox.git.branches(repo_path)
    assert branches.current_branch == "main"
    assert "main" in branches.branches
    assert "feature" in branches.branches


@pytest.mark.skip_debug()
def test_checkout_branch_switches_branch(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.commands.run(f'git -C "{repo_path}" branch feature')
    git_sandbox.git.checkout_branch(repo_path, "feature")

    head = git_sandbox.commands.run(
        f'git -C "{repo_path}" rev-parse --abbrev-ref HEAD'
    ).stdout.strip()
    assert head == "feature"


@pytest.mark.skip_debug()
def test_create_branch_creates_branch(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.git.create_branch(repo_path, "feature")

    branches = git_sandbox.git.branches(repo_path)
    assert "feature" in branches.branches
    assert branches.current_branch == "feature"


@pytest.mark.skip_debug()
def test_delete_branch_removes_branch(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.commands.run(f'git -C "{repo_path}" branch feature')
    git_sandbox.git.delete_branch(repo_path, "feature")

    branch = git_sandbox.commands.run(
        f'git -C "{repo_path}" branch --list feature'
    ).stdout.strip()
    branches = git_sandbox.git.branches(repo_path)
    assert branch == ""
    assert "feature" not in branches.branches
