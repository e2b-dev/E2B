import pytest

from e2b import NotFoundException, FilesystemEventType, Sandbox, SandboxException


def test_watch_directory_changes(sandbox: Sandbox):
    dirname = "test_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."

    sandbox.files.make_dir(dirname)
    handle = sandbox.files.watch(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    events = handle.get_new_events()
    assert len(events) == 3
    assert events[0].type == FilesystemEventType.CREATE
    assert events[0].name == filename
    assert events[1].type == FilesystemEventType.CHMOD
    assert events[1].name == filename
    assert events[2].type == FilesystemEventType.WRITE
    assert events[2].name == filename

    handle.stop()


def test_watch_iterated(sandbox: Sandbox):
    dirname = "test_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    handle = sandbox.files.watch(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    events = handle.get_new_events()
    assert len(events) == 3

    sandbox.files.write(f"{dirname}/{filename}", new_content)
    events = handle.get_new_events()
    for event in events:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            break

    handle.stop()


def test_watch_non_existing_directory(sandbox: Sandbox):
    dirname = "non_existing_watch_dir"

    with pytest.raises(NotFoundException):
        sandbox.files.watch(dirname)


def test_watch_file(sandbox: Sandbox):
    filename = "test_watch.txt"
    sandbox.files.write(filename, "This file will be watched.")

    with pytest.raises(SandboxException):
        sandbox.files.watch(filename)
