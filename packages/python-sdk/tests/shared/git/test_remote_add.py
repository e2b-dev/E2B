import pytest


@pytest.mark.skip_debug()
def test_remote_add_overwrite(git_sandbox, git_repo, git_daemon):
    repo_path = git_repo
    remote_url = git_daemon["remote_url"]

    git_sandbox.git.remote_add(repo_path, "origin", remote_url)
    current_url = git_sandbox.commands.run(
        f'git -C "{repo_path}" remote get-url origin'
    ).stdout.strip()
    assert current_url == remote_url

    second_path = f"{git_daemon['base_dir']}/remote-2.git"
    git_sandbox.commands.run(f'git init --bare --initial-branch=main "{second_path}"')
    second_url = f"git://127.0.0.1:{git_daemon['port']}/remote-2.git"
    git_sandbox.git.remote_add(repo_path, "origin", second_url, overwrite=True)

    updated_url = git_sandbox.commands.run(
        f'git -C "{repo_path}" remote get-url origin'
    ).stdout.strip()
    assert updated_url == second_url
