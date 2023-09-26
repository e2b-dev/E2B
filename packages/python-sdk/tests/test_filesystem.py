import filecmp
from asyncio import sleep
from os import getenv, path

from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


async def test_list_files():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)
    await session.filesystem.make_dir("/test/new")

    ls = await session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    await session.close()


async def test_create_file():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)
    await session.filesystem.make_dir("/test")
    await session.filesystem.write("/test/test.txt", "Hello World!")

    ls = await session.filesystem.list("/test")
    assert ["test.txt"] == [x.name for x in ls]

    await session.close()


async def test_read_and_write():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)

    await session.filesystem.write("/tmp/test.txt", "Hello World!")

    content = await session.filesystem.read("/tmp/test.txt")
    assert content == "Hello World!"

    await session.close()


async def test_list_delete_files():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)
    await session.filesystem.make_dir("/test/new")

    ls = await session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    await session.filesystem.remove("/test/new")

    ls = await session.filesystem.list("/test")
    assert [] == [x.name for x in ls]

    await session.close()


async def test_watch_dir():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)
    await session.filesystem.write("/tmp/test.txt", "Hello")

    watcher = await session.filesystem.watch_dir("/tmp")

    events = []
    watcher.add_event_listener(lambda e: events.append(e))

    await watcher.start()
    await session.filesystem.write("/tmp/test.txt", "World!")
    await sleep(1)
    await watcher.stop()

    assert len(events) >= 1

    event = events[0]
    assert event["operation"] == "Write"
    assert event["path"] == "/tmp/test.txt"

    await session.close()


async def test_write_bytes():
    file_name = "video.webm"
    local_dir = "tests/assets"
    remote_dir = "/tmp"

    local_path = path.join(local_dir, file_name)
    remote_path = path.join(remote_dir, file_name)

    # TODO: This test isn't complete since we can't verify the size of the file inside session.
    # We don't have any SDK function to get the size of a file inside session.

    session = await Session.create("Nodejs", api_key=E2B_API_KEY)

    # Upload the file
    with open(local_path, "rb") as f:
        content = f.read()
        await session.filesystem.write_bytes(remote_path, content)

    # Check if the file exists inside session
    files = await session.filesystem.list(remote_dir)
    assert file_name in [x.name for x in files]

    await session.close()


async def test_read_bytes():
    file_name = "video.webm"
    local_dir = "tests/assets"
    remote_dir = "/tmp"

    local_path = path.join(local_dir, file_name)
    remote_path = path.join(remote_dir, file_name)

    # TODO: This test isn't complete since we can't verify the size of the file inside session.
    # We don't have any SDK function to get the size of a file inside session.

    session = await Session.create("Nodejs", api_key=E2B_API_KEY)

    # Upload the file first
    with open(local_path, "rb") as f:
        content = f.read()
        await session.filesystem.write_bytes(remote_path, content)

    # Download the file
    content = await session.filesystem.read_bytes(remote_path)

    # Save the file
    downloaded_path = path.join(local_dir, "video-downloaded.webm")
    with open(downloaded_path, "wb") as f:
        f.write(content)

    # Compare if both files are equal
    assert filecmp.cmp(local_path, downloaded_path)

    await session.close()
