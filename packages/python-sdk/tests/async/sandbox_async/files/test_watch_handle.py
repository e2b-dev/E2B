import asyncio

import pytest

from e2b.envd.filesystem.filesystem_pb2 import (
    EventType,
    FilesystemEvent,
    WatchDirResponse,
)
from e2b.sandbox_async.filesystem.watch_handle import AsyncWatchHandle


def filesystem_event(name: str) -> WatchDirResponse:
    return WatchDirResponse(
        filesystem=FilesystemEvent(name=name, type=EventType.EVENT_TYPE_WRITE)
    )


async def test_on_exit_called_without_error_on_stream_end():
    async def events():
        return
        yield

    exited = asyncio.Event()
    exit_errors = []

    async def on_exit(error):
        exit_errors.append(error)
        exited.set()

    AsyncWatchHandle(events(), on_event=lambda e: None, on_exit=on_exit)

    await asyncio.wait_for(exited.wait(), timeout=5)
    assert exit_errors == [None]


async def test_on_exit_called_with_error_on_stream_failure():
    async def events():
        raise RuntimeError("stream failed")
        yield

    exited = asyncio.Event()
    exit_errors = []

    def on_exit(error):
        exit_errors.append(error)
        exited.set()

    AsyncWatchHandle(events(), on_event=lambda e: None, on_exit=on_exit)

    await asyncio.wait_for(exited.wait(), timeout=5)
    assert len(exit_errors) == 1
    assert exit_errors[0] is not None


async def test_async_on_event_callbacks_are_awaited_sequentially():
    async def events():
        yield filesystem_event("a")
        yield filesystem_event("b")

    order = []
    exited = asyncio.Event()

    async def on_event(event):
        order.append(f"start:{event.name}")
        await asyncio.sleep(0.01)
        order.append(f"end:{event.name}")

    AsyncWatchHandle(events(), on_event=on_event, on_exit=lambda e: exited.set())

    await asyncio.wait_for(exited.wait(), timeout=5)
    assert order == ["start:a", "end:a", "start:b", "end:b"]


async def test_on_event_error_routed_to_on_exit():
    async def events():
        yield filesystem_event("a")

    exited = asyncio.Event()
    exit_errors = []

    def on_event(event):
        raise RuntimeError("callback failed")

    def on_exit(error):
        exit_errors.append(error)
        exited.set()

    AsyncWatchHandle(events(), on_event=on_event, on_exit=on_exit)

    await asyncio.wait_for(exited.wait(), timeout=5)
    assert len(exit_errors) == 1
    assert isinstance(exit_errors[0], RuntimeError)
    assert str(exit_errors[0]) == "callback failed"


async def test_on_exit_called_without_error_on_stop():
    async def events():
        await asyncio.Event().wait()
        yield

    exit_errors = []

    handle = AsyncWatchHandle(
        events(), on_event=lambda e: None, on_exit=lambda e: exit_errors.append(e)
    )

    await asyncio.sleep(0.1)
    await handle.stop()
    assert exit_errors == [None]


async def test_stop_propagates_caller_cancellation():
    async def events():
        await asyncio.Event().wait()
        yield

    exit_started = asyncio.Event()

    async def on_exit(error):
        exit_started.set()
        # Hang so stop() stays blocked awaiting the watcher task.
        await asyncio.Event().wait()

    handle = AsyncWatchHandle(events(), on_event=lambda e: None, on_exit=on_exit)

    await asyncio.sleep(0.1)

    # Cancelling the stop() caller (here via wait_for timing out) must surface
    # as a timeout, not be swallowed and reported as a successful stop.
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(handle.stop(), timeout=0.2)

    assert exit_started.is_set()


async def test_stop_raises_on_exit_errors():
    async def events():
        await asyncio.Event().wait()
        yield

    def on_exit(error):
        raise RuntimeError("on_exit failed")

    handle = AsyncWatchHandle(events(), on_event=lambda e: None, on_exit=on_exit)

    await asyncio.sleep(0.1)
    with pytest.raises(RuntimeError, match="on_exit failed"):
        await handle.stop()
