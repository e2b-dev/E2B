import pytest

from asyncio import Event

from e2b import (
    NotFoundException,
    AsyncSandbox,
    FilesystemEvent,
    FilesystemEventType,
    SandboxException,
)


async def test_watch_directory_changes(async_sandbox: AsyncSandbox):
    dirname = "test_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."
    new_content = "This file has been modified."

    await async_sandbox.files.make_dir(dirname)
    await async_sandbox.files.write(f"{dirname}/{filename}", content)

    event_triggered = Event()

    def handle_event(e: FilesystemEvent):
        if e.type == FilesystemEventType.WRITE and e.name == filename:
            event_triggered.set()

    handle = await async_sandbox.files.watch_dir(dirname, on_event=handle_event)

    await async_sandbox.files.write(f"{dirname}/{filename}", new_content)

    await event_triggered.wait()

    await handle.stop()


async def test_watch_recursive_directory_changes(async_sandbox: AsyncSandbox):
    dirname = "test_recursive_watch_dir"
    nested_dirname = "test_nested_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."

    await async_sandbox.files.remove(dirname)
    await async_sandbox.files.make_dir(f"{dirname}/{nested_dirname}")

    event_triggered = Event()

    expected_filename = f"{nested_dirname}/{filename}"

    def handle_event(e: FilesystemEvent):
        if e.type == FilesystemEventType.WRITE and e.name == expected_filename:
            event_triggered.set()

    handle = await async_sandbox.files.watch_dir(
        dirname, on_event=handle_event, recursive=True
    )

    await async_sandbox.files.write(f"{dirname}/{nested_dirname}/{filename}", content)

    await event_triggered.wait()

    await handle.stop()


async def test_watch_recursive_directory_after_nested_folder_addition(
    async_sandbox: AsyncSandbox,
):
    dirname = "test_recursive_watch_dir_add"
    nested_dirname = "test_nested_watch_dir"
    filename = "test_watch.txt"
    content = "This file will be watched."

    await async_sandbox.files.remove(dirname)
    await async_sandbox.files.make_dir(dirname)

    event_triggered_file = Event()
    event_triggered_folder = Event()

    expected_filename = f"{nested_dirname}/{filename}"

    def handle_event(e: FilesystemEvent):
        if e.type == FilesystemEventType.WRITE and e.name == expected_filename:
            event_triggered_file.set()
            return
        if e.type == FilesystemEventType.CREATE and e.name == nested_dirname:
            event_triggered_folder.set()

    handle = await async_sandbox.files.watch_dir(
        dirname, on_event=handle_event, recursive=True
    )

    await async_sandbox.files.make_dir(f"{dirname}/{nested_dirname}")
    await event_triggered_folder.wait()

    await async_sandbox.files.write(f"{dirname}/{nested_dirname}/{filename}", content)
    await event_triggered_file.wait()

    await handle.stop()


async def test_watch_non_existing_directory(async_sandbox: AsyncSandbox):
    dirname = "non_existing_watch_dir"

    with pytest.raises(NotFoundException):
        await async_sandbox.files.watch_dir(dirname, on_event=lambda e: None)


async def test_watch_file(async_sandbox: AsyncSandbox):
    filename = "test_watch.txt"
    await async_sandbox.files.write(filename, "This file will be watched.")

    with pytest.raises(SandboxException):
        await async_sandbox.files.watch_dir(filename, on_event=lambda e: None)


async def test_watch_file_with_secured_envd(async_sandbox):
    await async_sandbox.files.watch_dir("/home/user/", on_event=lambda e: None)
    await async_sandbox.files.write("test_watch.txt", "This file will be watched.")
