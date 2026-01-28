import pytest


@pytest.mark.skip_debug()
def test_get_config_reads_local_config(git_sandbox, git_repo):
    git_sandbox.commands.run(f'git -C "{git_repo}" config --local pull.rebase true')

    value = git_sandbox.git.get_config("pull.rebase", scope="local", path=git_repo)
    assert value == "true"
