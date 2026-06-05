import asyncio

import pytest

from e2b.envd.process import process_pb2
from e2b.sandbox_async.commands.command_handle import AsyncCommandHandle


def _data_event(stdout: bytes) -> process_pb2.StartResponse:
    event = process_pb2.StartResponse()
    event.event.data.stdout = stdout
    return event


def _end_event(exit_code: int = 0, error: str = "") -> process_pb2.StartResponse:
    event = process_pb2.StartResponse()
    event.event.end.exit_code = exit_code
    if error:
        event.event.end.error = error
    return event


async def _noop_kill() -> bool:
    return True


async def test_wait_stops_at_end_event_even_if_stream_stays_open():
    """`wait()` must return as soon as the terminal end event arrives, without
    waiting for envd to close the HTTP stream."""
    closed = asyncio.Event()

    async def events():
        try:
            yield _data_event(b"hello")
            yield _end_event(0)
            # Simulate envd delaying the HTTP stream close indefinitely.
            await asyncio.sleep(3600)
        finally:
            closed.set()

    handle = AsyncCommandHandle(pid=1, handle_kill=_noop_kill, events=events())

    result = await asyncio.wait_for(handle.wait(), timeout=5)

    assert result.exit_code == 0
    assert result.stdout == "hello"
    # The underlying stream/connection must be released promptly (not at GC).
    await asyncio.wait_for(closed.wait(), timeout=5)


async def test_disconnect_releases_stream_while_iterating():
    """`disconnect()` must cancel the event task and release the stream without
    raising a concurrent-access error."""
    closed = asyncio.Event()
    iterating = asyncio.Event()

    async def events():
        try:
            yield _data_event(b"hello")
            iterating.set()
            await asyncio.sleep(3600)  # never sends an end event
        finally:
            closed.set()

    handle = AsyncCommandHandle(pid=1, handle_kill=_noop_kill, events=events())

    await asyncio.wait_for(iterating.wait(), timeout=5)
    await asyncio.wait_for(handle.disconnect(), timeout=5)
    await asyncio.wait_for(closed.wait(), timeout=5)


async def test_disconnect_releases_stream_during_callback():
    """`disconnect()` must release the stream even when the event task is blocked
    inside an output callback."""
    closed = asyncio.Event()
    in_callback = asyncio.Event()

    async def events():
        try:
            yield _data_event(b"hello")
            await asyncio.sleep(3600)
        finally:
            closed.set()

    async def on_stdout(_: str):
        in_callback.set()
        await asyncio.sleep(3600)

    handle = AsyncCommandHandle(
        pid=1, handle_kill=_noop_kill, events=events(), on_stdout=on_stdout
    )

    await asyncio.wait_for(in_callback.wait(), timeout=5)
    await asyncio.wait_for(handle.disconnect(), timeout=5)
    await asyncio.wait_for(closed.wait(), timeout=5)


async def test_iteration_exception_releases_stream():
    """An exception raised while iterating must still release the stream and
    surface through `wait()`."""
    closed = asyncio.Event()

    async def events():
        try:
            yield _data_event(b"hello")
            raise RuntimeError("boom")
        finally:
            closed.set()

    handle = AsyncCommandHandle(pid=1, handle_kill=_noop_kill, events=events())

    with pytest.raises(Exception):
        await asyncio.wait_for(handle.wait(), timeout=5)

    await asyncio.wait_for(closed.wait(), timeout=5)
