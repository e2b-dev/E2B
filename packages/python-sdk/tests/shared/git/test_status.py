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


@pytest.mark.skip_debug()
def test_status_reports_added_modified_deleted_renamed(
    git_sandbox, git_repo, git_author
):
    author_name, author_email = git_author

    git_sandbox.files.write(f"{git_repo}/README.md", "hello\n")
    git_sandbox.files.write(f"{git_repo}/DELETE.md", "delete me\n")
    git_sandbox.files.write(f"{git_repo}/RENAME.md", "rename me\n")
    git_sandbox.git.add(git_repo, all=True)
    git_sandbox.git.commit(
        git_repo,
        message="Initial commit",
        author_name=author_name,
        author_email=author_email,
    )

    git_sandbox.files.write(f"{git_repo}/README.md", "hello again\n")
    git_sandbox.files.write(f"{git_repo}/NEW.md", "new file\n")
    git_sandbox.git.add(git_repo, files=["NEW.md"])
    git_sandbox.commands.run(f'git -C "{git_repo}" rm DELETE.md')
    git_sandbox.commands.run(f'git -C "{git_repo}" mv RENAME.md RENAMED.md')

    status = git_sandbox.git.status(git_repo)
    modified = next(
        (item for item in status.file_status if item.name == "README.md"), None
    )
    added = next((item for item in status.file_status if item.name == "NEW.md"), None)
    deleted = next(
        (item for item in status.file_status if item.name == "DELETE.md"), None
    )
    renamed = next(
        (item for item in status.file_status if item.name == "RENAMED.md"),
        None,
    )

    assert modified is not None
    assert modified.status == "modified"
    assert modified.staged is False

    assert added is not None
    assert added.status == "added"
    assert added.staged is True

    assert deleted is not None
    assert deleted.status == "deleted"
    assert deleted.staged is True

    assert renamed is not None
    assert renamed.status == "renamed"
    assert renamed.staged is True
    assert renamed.renamed_from == "RENAME.md"

    assert status.has_changes is True
    assert status.has_staged is True
    assert status.has_untracked is False
    assert status.has_conflicts is False
    assert status.total_count == 4
    assert status.staged_count == 3
    assert status.unstaged_count == 1
    assert status.untracked_count == 0
    assert status.conflict_count == 0
