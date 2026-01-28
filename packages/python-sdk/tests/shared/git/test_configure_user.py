def test_configure_user_sets_global_config(git_sandbox, git_author):
    author_name, author_email = git_author

    git_sandbox.git.configure_user(author_name, author_email)

    name = git_sandbox.commands.run("git config --global --get user.name").stdout.strip()
    email = git_sandbox.commands.run(
        "git config --global --get user.email"
    ).stdout.strip()
    assert name == author_name
    assert email == author_email
