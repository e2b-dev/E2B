import pytest


@pytest.mark.skip_debug()
def test_restore_unstages_changes(git_sandbox, git_repo_with_commit):
    git_sandbox.files.write(f"{git_repo_with_commit}/README.md", "changed\n")
    git_sandbox.git.add(git_repo_with_commit, files=["README.md"])

    status = git_sandbox.git.status(git_repo_with_commit)
    assert status.has_staged is True

    git_sandbox.git.restore(
        git_repo_with_commit,
        paths=["README.md"],
        staged=True,
        worktree=False,
    )

    status_after = git_sandbox.git.status(git_repo_with_commit)
    assert status_after.has_staged is False
    assert status_after.has_changes is True


@pytest.mark.skip_debug()
def test_restore_worktree_discards_changes(git_sandbox, git_repo_with_commit):
    git_sandbox.files.write(f"{git_repo_with_commit}/README.md", "changed\n")

    status = git_sandbox.git.status(git_repo_with_commit)
    assert status.is_clean is False

    git_sandbox.git.restore(git_repo_with_commit, paths=["README.md"])

    status_after = git_sandbox.git.status(git_repo_with_commit)
    assert status_after.is_clean is True

    contents = git_sandbox.files.read(f"{git_repo_with_commit}/README.md")
    assert contents == "hello\n"
