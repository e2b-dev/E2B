import pytest


@pytest.mark.skip_debug()
def test_reset_hard_discards_changes(git_sandbox, git_repo_with_commit):
    git_sandbox.files.write(f"{git_repo_with_commit}/README.md", "changed\n")

    status = git_sandbox.git.status(git_repo_with_commit)
    assert status.is_clean is False

    git_sandbox.git.reset(git_repo_with_commit, mode="hard", target="HEAD")

    status_after = git_sandbox.git.status(git_repo_with_commit)
    assert status_after.is_clean is True

    contents = git_sandbox.files.read(f"{git_repo_with_commit}/README.md")
    assert contents == "hello\n"
