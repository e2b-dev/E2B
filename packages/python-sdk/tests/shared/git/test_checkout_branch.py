import pytest

@pytest.mark.skip_debug()
def test_checkout_branch_switches_branch(git_sandbox, git_repo_with_commit):
    repo_path = git_repo_with_commit

    git_sandbox.commands.run(f'git -C "{repo_path}" branch feature')
    git_sandbox.git.checkout_branch(repo_path, "feature")

    head = git_sandbox.commands.run(
        f'git -C "{repo_path}" rev-parse --abbrev-ref HEAD'
    ).stdout.strip()
    assert head == "feature"
