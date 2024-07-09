from time import sleep

import pytest

from e2b import NotFoundException
from e2b.sandbox.filesystem.watch_handle import FilesystemEventType


def test_watch_directory_changes(sandbox):
    dirname = "test_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    sandbox.files.make_dir(dirname)
    sandbox.files.write(f"{dirname}/{filename}", content)

    event_triggered = False
    handle = sandbox.files.watch(dirname)

    sandbox.files.write(f"{dirname}/{filename}", new_content)

    sleep(1)  # wait for the event to be triggered

    for event in handle:
        if event.type == FilesystemEventType.WRITE and event.name == filename:
            event_triggered = True

    assert event_triggered

    handle.close()


def test_watch_non_existing_directory(sandbox):
    dirname = "non_existing_watch_dir"

    with pytest.raises(NotFoundException):
        sandbox.files.watch(dirname)

# TODO: Add test for nonexistent file
