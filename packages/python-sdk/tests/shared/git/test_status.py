import pytest

@pytest.mark.skip_debug()
def test_status_reports_untracked_file(git_sandbox, git_repo):
    git_sandbox.files.write(f"{git_repo}/README.md", "hello\n")

    status = git_sandbox.git.status(git_repo)
    entry = next((item for item in status.file_status if item.name == "README.md"), None)

    assert entry is not None
    assert entry.status == "untracked"
