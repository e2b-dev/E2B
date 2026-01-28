import pytest


@pytest.mark.skip_debug()
def test_status_reports_untracked_file(git_sandbox, git_repo):
    git_sandbox.files.write(f"{git_repo}/README.md", "hello\n")

    status = git_sandbox.git.status(git_repo)
    entry = next(
        (item for item in status.file_status if item.name == "README.md"), None
    )

    assert entry is not None
    assert entry.status == "untracked"
    assert status.is_clean is False
    assert status.has_changes is True
    assert status.has_untracked is True
    assert status.has_staged is False
    assert status.has_conflicts is False
    assert status.total_count == 1
    assert status.staged_count == 0
    assert status.unstaged_count == 1
    assert status.untracked_count == 1
    assert status.conflict_count == 0
