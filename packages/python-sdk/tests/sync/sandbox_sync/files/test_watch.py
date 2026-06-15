import pytest

from e2b import (
    FileNotFoundException,
    FileType,
    FilesystemEventType,
    Sandbox,
    SandboxException,
)


def test_watch_directory_changes_with_entry_info(sandbox: Sandbox):
    dirname = "test_watch_dir_entry"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    handle = sandbox.files.watch_dir(dirname, include_entry=True)
    sandbox.files.write(f"{dirname}/{filename}", new_content)

    events = handle.get_new_events()
    write_event = None
    for event in events:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            write_event = event
            break

    assert write_event is not None, (
        f"Expected WRITE event for {filename}, but got events: {events}"
    )
    # The entry is populated best-effort for events where the path still exists.
    assert write_event.entry is not None
    assert write_event.entry.name == filename
    assert write_event.entry.path == f"/home/user/{dirname}/{filename}"
    assert write_event.entry.type == FileType.FILE

    handle.stop()


def test_watch_directory_changes_with_network_mounts_allowed(sandbox: Sandbox):
    dirname = "test_watch_dir_network_mounts"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    # The flag only lifts the network-mount restriction — watching a regular
    # directory must work the same with it enabled.
    handle = sandbox.files.watch_dir(dirname, allow_network_mounts=True)
    sandbox.files.write(f"{dirname}/{filename}", new_content)

    events = handle.get_new_events()
    write_event = None
    for event in events:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            write_event = event
            break

    assert write_event is not None, (
        f"Expected WRITE event for {filename}, but got events: {events}"
    )

    handle.stop()


def test_watch_directory_changes(sandbox: Sandbox):
    dirname = "test_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    handle = sandbox.files.watch_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", new_content)

    events = handle.get_new_events()
    write_event = None
    for event in events:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            write_event = event
            break

    assert write_event is not None, (
        f"Expected WRITE event for {filename}, but got events: {events}"
    )
    assert write_event.name == filename

    handle.stop()


def test_watch_iterated(sandbox: Sandbox):
    dirname = "test_watch_dir_iterated"
    filename = "test_watch_iterated.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    handle = sandbox.files.watch_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    events = handle.get_new_events()
    assert len(events) == 3

    sandbox.files.write(f"{dirname}/{filename}", new_content)
    events = handle.get_new_events()
    for event in events:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            break

    handle.stop()


def test_watch_recursive_directory_changes(sandbox: Sandbox):
    dirname = "test_recursive_watch_dir"
    nested_dirname = "test_nested_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."

    sandbox.files.remove(dirname)
    sandbox.files.make_dir(f"{dirname}/{nested_dirname}")

    handle = sandbox.files.watch_dir(dirname, recursive=True)
    sandbox.files.write(f"{dirname}/{nested_dirname}/{filename}", content)

    events = handle.get_new_events()
    assert len(events) == 3
    expected_filename = f"{nested_dirname}/{filename}"
    assert events[0].type == FilesystemEventType.CREATE
    assert events[0].name == expected_filename

    handle.stop()


def test_watch_recursive_directory_after_nested_folder_addition(sandbox: Sandbox):
    dirname = "test_recursive_watch_dir_add"
    nested_dirname = "test_nested_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."

    sandbox.files.remove(dirname)
    sandbox.files.make_dir(dirname)

    handle = sandbox.files.watch_dir(dirname, recursive=True)

    sandbox.files.make_dir(f"{dirname}/{nested_dirname}")
    sandbox.files.write(f"{dirname}/{nested_dirname}/{filename}", content)

    expected_filename = f"{nested_dirname}/{filename}"

    events = handle.get_new_events()
    file_changed = False
    folder_created = False
    for event in events:
        if event.type == FilesystemEventType.WRITE and event.name == expected_filename:
            file_changed = True
            continue
        if event.type == FilesystemEventType.CREATE and event.name == nested_dirname:
            folder_created = True

    assert folder_created
    assert file_changed

    handle.stop()


def test_watch_non_existing_directory(sandbox: Sandbox):
    dirname = "non_existing_watch_dir"

    with pytest.raises(FileNotFoundException):
        sandbox.files.watch_dir(dirname)


def test_watch_file(sandbox: Sandbox):
    filename = "test_watch.txt"
    sandbox.files.write(filename, "This file will be watched.")

    with pytest.raises(SandboxException):
        sandbox.files.watch_dir(filename)


def test_watch_file_with_secured_envd(sandbox_factory):
    sbx = sandbox_factory(timeout=30, secure=True)

    handle = sbx.files.watch_dir("/home/user/")
    sbx.files.write("test_watch.txt", "This file will be watched.")

    events = handle.get_new_events()
    assert any(
        event.type == FilesystemEventType.WRITE and event.name == "test_watch.txt"
        for event in events
    )

    handle.stop()
