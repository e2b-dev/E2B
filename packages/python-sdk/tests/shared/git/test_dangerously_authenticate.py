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
    configured_helper = git_sandbox.git.get_config("credential.helper", scope="global")
    assert helper == "store"
    assert configured_helper == "store"

    credentials = git_sandbox.commands.run(
        'cat "$HOME/.git-credentials"'
    ).stdout.strip()
    assert f"{protocol}://{username}:{password}@{host}" in credentials

    filled = git_sandbox.commands.run(
        f"printf '%s' 'protocol={protocol}\nhost={host}\n\n' | git credential fill"
    ).stdout
    assert f"username={username}" in filled
    assert f"password={password}" in filled
