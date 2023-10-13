import asyncio
from typing import List
from unittest.mock import MagicMock

from e2b import SyncSession, FilesystemEvent


def test_process_on_stdout_stderr():
    session = SyncSession.create("Nodejs")

    stdout = []
    stderr = []

    proc = session.process.start(
        "pwd",
        on_stdout=lambda data: stdout.append(data),
        on_stderr=lambda data: stderr.append(data),
        cwd="/tmp",
    )

    output = proc.wait()

    assert not output.error
    assert output.stdout == "/tmp"
    assert output.stderr == ""
    assert list(map(lambda message: message.line, stdout)) == ["/tmp"]
    assert stderr == []

    session.close()


def test_process_on_exit():
    session = SyncSession.create("Nodejs")

    on_exit = MagicMock()

    proc = session.process.start(
        "pwd",
        on_exit=lambda: on_exit(),
    )

    proc.wait()
    on_exit.assert_called_once()

    session.close()


def test_process_send_stdin():
    session = SyncSession.create("Nodejs")

    proc = session.process.start(
        'read -r line; echo "$line"',
        cwd="/code",
    )
    proc.send_stdin("ping\n")
    proc.wait()

    assert proc.output.stdout == "ping"

    assert len(proc.output_messages) == 1
    message = proc.output_messages[0]
    assert message.line == "ping"
    assert not message.error

    session.close()


def test_list_files():
    session = SyncSession.create("Nodejs")
    session.filesystem.make_dir("/test/new")

    ls = session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    session.close()


def test_create_file():
    session = SyncSession.create("Nodejs")
    session.filesystem.make_dir("/test")
    session.filesystem.write("/test/test.txt", "Hello World!")

    ls = session.filesystem.list("/test")
    assert ["test.txt"] == [x.name for x in ls]

    session.close()


def test_read_and_write():
    session = SyncSession.create("Nodejs")

    session.filesystem.write("/tmp/test.txt", "Hello World!")

    content = session.filesystem.read("/tmp/test.txt")
    assert content == "Hello World!"

    session.close()


def test_list_delete_files():
    session = SyncSession.create("Nodejs")
    session.filesystem.make_dir("/test/new")

    ls = session.filesystem.list("/test")
    assert ["new"] == [x.name for x in ls]

    session.filesystem.remove("/test/new")

    ls = session.filesystem.list("/test")
    assert [] == [x.name for x in ls]

    session.close()


def test_watch_dir():
    session = SyncSession.create("Nodejs")
    session.filesystem.write("/tmp/test.txt", "Hello")

    watcher = session.filesystem.watch_dir("/tmp")

    events: List[FilesystemEvent] = []
    watcher.add_event_listener(lambda e: events.append(e))

    watcher.start()
    session.filesystem.write("/tmp/test.txt", "World!")
    session._loop.run_until_complete(asyncio.sleep(1))
    watcher.stop()

    assert len(events) >= 1

    event = events[0]
    assert event.operation == "Write"
    assert event.path == "/tmp/test.txt"

    session.close()
