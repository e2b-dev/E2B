import pytest


@pytest.mark.skip_debug()
def test_dangerously_authenticate_sets_helper(git_sandbox, git_credentials):
    username, password, host, protocol = git_credentials

    git_sandbox.git.dangerously_authenticate(
        username,
        password,
        host=host,
        protocol=protocol,
    )

    helper = git_sandbox.commands.run(
        "git config --global --get credential.helper"
    ).stdout.strip()
    assert helper == "store"
