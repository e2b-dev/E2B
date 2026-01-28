def test_commit_creates_commit(git_sandbox, git_repo, git_author):
    author_name, author_email = git_author

    git_sandbox.files.write(f"{git_repo}/README.md", "hello\n")
    git_sandbox.git.add(git_repo, all=True)
    git_sandbox.git.commit(
        git_repo,
        message="Initial commit",
        author_name=author_name,
        author_email=author_email,
    )

    message = git_sandbox.commands.run(
        f'git -C "{git_repo}" log -1 --pretty=%B'
    ).stdout.strip()
    assert message == "Initial commit"
