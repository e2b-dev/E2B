def test_config_get_reads_local_config(git_sandbox, git_repo):
    git_sandbox.commands.run(
        f'git -C "{git_repo}" config --local pull.rebase true'
    )

    value = git_sandbox.git.config_get("pull.rebase", scope="local", path=git_repo)
    assert value == "true"
