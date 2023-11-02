import filecmp

from os import path
from time import sleep
from typing import List

from e2b import Sandbox, FilesystemEvent


def test_list_files():
    sandbox = Sandbox()
    sandbox.filesystem.make_dir("/test/new")

    ls = sandbox.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    sandbox.close()


def test_create_file():
    sandbox = Sandbox()
    sandbox.filesystem.make_dir("/test")
    sandbox.filesystem.write("/test/test.txt", "Hello World!")

    ls = sandbox.filesystem.list("/test")
    assert ["test.txt"] == [x.name for x in ls]

    sandbox.close()


def test_read_and_write():
    sandbox = Sandbox()

    sandbox.filesystem.write("/tmp/test.txt", "Hello World!")

    content = sandbox.filesystem.read("/tmp/test.txt")
    assert content == "Hello World!"

    sandbox.close()


def test_list_delete_files():
    sandbox = Sandbox()
    sandbox.filesystem.make_dir("/test/new")

    ls = sandbox.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    sandbox.filesystem.remove("/test/new")

    ls = sandbox.filesystem.list("/test")
    assert [] == [x.name for x in ls]

    sandbox.close()


def test_watch_dir():
    sandbox = Sandbox()
    sandbox.filesystem.write("/tmp/test.txt", "Hello")

    watcher = sandbox.filesystem.watch_dir("/tmp")

    events: List[FilesystemEvent] = []
    watcher.add_event_listener(lambda e: events.append(e))

    watcher.start()
    sandbox.filesystem.write("/tmp/test.txt", "World!")
    sleep(1)
    watcher.stop()

    assert len(events) >= 1

    event = events[0]
    assert event.operation == "Write"
    assert event.path == "/tmp/test.txt"

    sandbox.close()


def test_write_bytes():
    file_name = "video.webm"
    local_dir = "tests/assets"
    remote_dir = "/tmp"

    local_path = path.join(local_dir, file_name)
    remote_path = path.join(remote_dir, file_name)

    # TODO: This test isn't complete since we can't verify the size of the file inside sandbox.
    # We don't have any SDK function to get the size of a file inside sandbox.

    sandbox = Sandbox()

    # Upload the file
    with open(local_path, "rb") as f:
        content = f.read()
        sandbox.filesystem.write_bytes(remote_path, content)

    # Check if the file exists inside sandbox
    files = sandbox.filesystem.list(remote_dir)
    assert file_name in [x.name for x in files]

    sandbox.close()


def test_read_bytes():
    file_name = "video.webm"
    local_dir = "tests/assets"
    remote_dir = "/tmp"

    local_path = path.join(local_dir, file_name)
    remote_path = path.join(remote_dir, file_name)

    # TODO: This test isn't complete since we can't verify the size of the file inside sandbox.
    # We don't have any SDK function to get the size of a file inside sandbox.

    sandbox = Sandbox()

    # Upload the file first
    with open(local_path, "rb") as f:
        content = f.read()
        sandbox.filesystem.write_bytes(remote_path, content)

    # Download the file
    content = sandbox.filesystem.read_bytes(remote_path)

    # Save the file
    downloaded_path = path.join(local_dir, "video-downloaded.webm")
    with open(downloaded_path, "wb") as f:
        f.write(content)

    # Compare if both files are equal
    assert filecmp.cmp(local_path, downloaded_path)

    sandbox.close()
