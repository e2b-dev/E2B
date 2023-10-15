import filecmp
from os import path
from time import sleep
from typing import List

from e2b import Session, FilesystemEvent


def test_list_files():
    session = Session("Nodejs")
    session.filesystem.make_dir("/test/new")

    ls = session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    session.close()


def test_create_file():
    session = Session("Nodejs")
    session.filesystem.make_dir("/test")
    session.filesystem.write("/test/test.txt", "Hello World!")

    ls = session.filesystem.list("/test")
    assert ["test.txt"] == [x.name for x in ls]

    session.close()


def test_read_and_write():
    session = Session("Nodejs")

    session.filesystem.write("/tmp/test.txt", "Hello World!")

    content = session.filesystem.read("/tmp/test.txt")
    assert content == "Hello World!"

    session.close()


def test_list_delete_files():
    session = Session("Nodejs")
    session.filesystem.make_dir("/test/new")

    ls = session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    session.filesystem.remove("/test/new")

    ls = session.filesystem.list("/test")
    assert [] == [x.name for x in ls]

    session.close()


def test_watch_dir():
    session = Session("Nodejs")
    session.filesystem.write("/tmp/test.txt", "Hello")

    watcher = session.filesystem.watch_dir("/tmp")

    events: List[FilesystemEvent] = []
    watcher.add_event_listener(lambda e: events.append(e))

    watcher.start()
    session.filesystem.write("/tmp/test.txt", "World!")
    sleep(1)
    watcher.stop()

    assert len(events) >= 1

    event = events[0]
    assert event.operation == "Write"
    assert event.path == "/tmp/test.txt"

    session.close()


def test_write_bytes():
    file_name = "video.webm"
    local_dir = "tests/assets"
    remote_dir = "/tmp"

    local_path = path.join(local_dir, file_name)
    remote_path = path.join(remote_dir, file_name)

    # TODO: This test isn't complete since we can't verify the size of the file inside session.
    # We don't have any SDK function to get the size of a file inside session.

    session = Session("Nodejs")

    # Upload the file
    with open(local_path, "rb") as f:
        content = f.read()
        session.filesystem.write_bytes(remote_path, content)

    # Check if the file exists inside session
    files = session.filesystem.list(remote_dir)
    assert file_name in [x.name for x in files]

    session.close()


def test_read_bytes():
    file_name = "video.webm"
    local_dir = "tests/assets"
    remote_dir = "/tmp"

    local_path = path.join(local_dir, file_name)
    remote_path = path.join(remote_dir, file_name)

    # TODO: This test isn't complete since we can't verify the size of the file inside session.
    # We don't have any SDK function to get the size of a file inside session.

    session = Session("Nodejs")

    # Upload the file first
    with open(local_path, "rb") as f:
        content = f.read()
        session.filesystem.write_bytes(remote_path, content)

    # Download the file
    content = session.filesystem.read_bytes(remote_path)

    # Save the file
    downloaded_path = path.join(local_dir, "video-downloaded.webm")
    with open(downloaded_path, "wb") as f:
        f.write(content)

    # Compare if both files are equal
    assert filecmp.cmp(local_path, downloaded_path)

    session.close()
