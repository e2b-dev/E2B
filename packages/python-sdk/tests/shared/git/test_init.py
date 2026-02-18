import pytest


@pytest.mark.skip_debug()
def test_init_creates_repo(git_sandbox, git_base_dir):
    repo_path = f"{git_base_dir}/repo"

    git_sandbox.git.init(repo_path, initial_branch="main")

    assert git_sandbox.files.exists(f"{repo_path}/.git")
    head = git_sandbox.commands.run(
        f'git -C "{repo_path}" symbolic-ref --short HEAD'
    ).stdout.strip()
    assert head == "main"
