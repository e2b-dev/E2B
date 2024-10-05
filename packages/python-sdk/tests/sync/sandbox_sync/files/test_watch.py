import pytest

from e2b import NotFoundException, FilesystemEventType, Sandbox


def test_watch_directory_changes(sandbox: Sandbox):
    dirname = "test_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    handle = sandbox.files.watch(dirname)

    sandbox.files.write(f"{dirname}/{filename}", new_content)

    for event in handle:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            break

    handle.close()


def test_watch_non_existing_directory(sandbox):
    dirname = "non_existing_watch_dir"

    with pytest.raises(NotFoundException):
        sandbox.files.watch(dirname)


# TODO: Add test for nonexistent file
