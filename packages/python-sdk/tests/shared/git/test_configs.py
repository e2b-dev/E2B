import pytest


@pytest.mark.skip_debug()
def test_get_config_reads_local_config(git_sandbox, git_repo):
    git_sandbox.commands.run(f'git -C "{git_repo}" config --local pull.rebase true')

    value = git_sandbox.git.get_config("pull.rebase", scope="local", path=git_repo)
    assert value == "true"


@pytest.mark.skip_debug()
def test_set_config_updates_local_config(git_sandbox, git_repo):
    git_sandbox.git.set_config(
        "pull.rebase",
        "true",
        scope="local",
        path=git_repo,
    )

    value = git_sandbox.commands.run(
        f'git -C "{git_repo}" config --local --get pull.rebase'
    ).stdout.strip()
    assert value == "true"
