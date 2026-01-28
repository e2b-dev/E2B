import pytest


@pytest.mark.skip_debug()
def test_configure_user_sets_global_config(git_sandbox, git_author):
    author_name, author_email = git_author

    git_sandbox.git.configure_user(author_name, author_email)

    name = git_sandbox.commands.run(
        "git config --global --get user.name"
    ).stdout.strip()
    email = git_sandbox.commands.run(
        "git config --global --get user.email"
    ).stdout.strip()
    configured_name = git_sandbox.git.get_config("user.name", scope="global")
    configured_email = git_sandbox.git.get_config("user.email", scope="global")
    assert name == author_name
    assert email == author_email
    assert configured_name == author_name
    assert configured_email == author_email
