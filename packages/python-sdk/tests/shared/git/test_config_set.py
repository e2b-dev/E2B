import pytest

@pytest.mark.skip_debug()
def test_config_set_updates_local_config(git_sandbox, git_repo):
    git_sandbox.git.config_set(
        "pull.rebase",
        "true",
        scope="local",
        path=git_repo,
    )

    value = git_sandbox.commands.run(
        f'git -C "{git_repo}" config --local --get pull.rebase'
    ).stdout.strip()
    assert value == "true"
