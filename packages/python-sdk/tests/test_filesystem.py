from asyncio import sleep

from e2b import Session


async def test_list_files():
    session = await Session.create("Nodejs")
    await session.filesystem.make_dir("/test/new")

    ls = await session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    await session.close()


async def test_create_file():
    session = await Session.create("Nodejs")
    await session.filesystem.make_dir("/test")
    await session.filesystem.write("/test/test.txt", "Hello World!")

    ls = await session.filesystem.list("/test")
    assert ["test.txt"] == [x.name for x in ls]

    await session.close()


async def test_read_and_write():
    session = await Session.create("Nodejs")

    await session.filesystem.write("/tmp/test.txt", "Hello World!")

    content = await session.filesystem.read("/tmp/test.txt")
    assert content == "Hello World!"

    await session.close()


async def test_list_delete_files():
    session = await Session.create("Nodejs")
    await session.filesystem.make_dir("/test/new")

    ls = await session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    await session.filesystem.remove("/test/new")

    ls = await session.filesystem.list("/test")
    assert [] == [x.name for x in ls]

    await session.close()


async def test_watch_dir():
    session = Session("Nodejs")
    await session.open()
    await session.filesystem.write("/tmp/test.txt", "Hello")

    watcher = await session.filesystem.watch_dir("/tmp")

    events = []
    watcher.add_event_listener(lambda e: events.append(e))

    await watcher.start()
    await session.filesystem.write("/tmp/test.txt", "World!")
    await sleep(1)
    await watcher.stop()

    assert len(events) == 1

    event = events[0]
    assert event["operation"] == "Write"
    assert event["path"] == "/tmp/test.txt"

    await session.close()
