import asyncio

import pytest

from e2b.envd.process import process_pb2
from e2b.sandbox_async.commands.command_handle import AsyncCommandHandle
from e2b.sandbox_sync.commands.command_handle import CommandHandle

EMOJI = "😀"
EMOJI_BYTES = EMOJI.encode("utf-8")  # 4 bytes


def _stdout_event(data: bytes) -> process_pb2.StartResponse:
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            data=process_pb2.ProcessEvent.DataEvent(stdout=data)
        )
    )


def _stderr_event(data: bytes) -> process_pb2.StartResponse:
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            data=process_pb2.ProcessEvent.DataEvent(stderr=data)
        )
    )


def _end_event(exit_code: int = 0) -> process_pb2.StartResponse:
    return process_pb2.StartResponse(
        event=process_pb2.ProcessEvent(
            end=process_pb2.ProcessEvent.EndEvent(
                exit_code=exit_code, exited=True, status="exited"
            )
        )
    )


async def _kill() -> bool:
    return True


class _AsyncControllableEvents:
    """Async event source that delivers items on demand.

    Lets a test hold the handle's event-handling task blocked waiting for the
    next event (idle between bursts), then push a late event after
    ``disconnect()`` to confirm it never reaches the callback — the transport
    condition that triggers the JS SDK leak.
    """

    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue()
        self._closed = False

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._closed and self._queue.empty():
            raise StopAsyncIteration
        item = await self._queue.get()
        if item is None:
            raise StopAsyncIteration
        return item

    def push(self, event):
        self._queue.put_nowait(event)

    async def aclose(self):
        # Intentionally does NOT unblock a read that is already suspended on
        # the queue: this models the JS-leak transport condition where the
        # stream stays open past the close request. The only thing that stops
        # the handle's event loop here is task cancellation in disconnect().
        self._closed = True


async def test_async_disconnect_stops_callbacks():
    events = _AsyncControllableEvents()
    chunks = []
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events,
        on_stdout=chunks.append,
    )

    # First burst is delivered to the live subscriber.
    events.push(_stdout_event(b"a"))
    for _ in range(200):
        if chunks == ["a"]:
            break
        await asyncio.sleep(0.005)
    assert chunks == ["a"]

    # disconnect() cancels the event-handling task and closes the stream, so
    # once it returns the callback must not fire again.
    await handle.disconnect()

    # A late event (stdout arriving after disconnect) must never reach the
    # callback.
    events.push(_stdout_event(b"b"))
    await asyncio.sleep(0.05)
    assert chunks == ["a"]


def test_sync_has_no_background_subscription():
    # The sync handle has no detached event-handling task: events are consumed
    # only while the caller iterates (e.g. inside wait()), so there is no
    # subscription that could keep firing after disconnect().
    consumed = []

    def events():
        consumed.append("started")
        yield _stdout_event(b"a")
        yield _end_event()

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())

    # Nothing is consumed until the caller iterates.
    assert consumed == []

    # disconnect() just closes the (un-started) stream — still nothing consumed.
    handle.disconnect()
    assert consumed == []


def test_sync_decodes_multibyte_chars_split_across_chunks():
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _stdout_event(EMOJI_BYTES[2:] + b"b")
        yield _stderr_event(EMOJI_BYTES[:3])
        yield _stderr_event(EMOJI_BYTES[3:])
        yield _end_event()

    chunks = []
    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())
    result = handle.wait(on_stdout=chunks.append)

    assert result.stdout == f"a{EMOJI}b"
    assert result.stderr == EMOJI
    assert "�" not in result.stdout
    assert "�" not in result.stderr
    assert "".join(chunks) == f"a{EMOJI}b"


def test_sync_replaces_incomplete_trailing_utf8():
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _end_event()

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())
    result = handle.wait()

    assert result.stdout == "a�"


async def test_async_decodes_multibyte_chars_split_across_chunks():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _stdout_event(EMOJI_BYTES[2:] + b"b")
        yield _stderr_event(EMOJI_BYTES[:3])
        yield _stderr_event(EMOJI_BYTES[3:])
        yield _end_event()

    chunks = []
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events(),
        on_stdout=chunks.append,
    )
    result = await handle.wait()

    assert result.stdout == f"a{EMOJI}b"
    assert result.stderr == EMOJI
    assert "�" not in result.stdout
    assert "�" not in result.stderr
    assert "".join(chunks) == f"a{EMOJI}b"


async def test_async_replaces_incomplete_trailing_utf8():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _end_event()

    handle = AsyncCommandHandle(pid=1, handle_kill=_kill, events=events())
    result = await handle.wait()

    assert result.stdout == "a�"


def test_sync_flushes_incomplete_trailing_utf8_without_end_event():
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])

    chunks = []
    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())
    for stdout, _, _ in handle:
        if stdout is not None:
            chunks.append(stdout)

    assert "".join(chunks) == "a�"


async def test_async_flushes_incomplete_trailing_utf8_without_end_event():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])

    chunks = []
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events(),
        on_stdout=chunks.append,
    )
    await handle._wait

    assert "".join(chunks) == "a�"


def test_sync_flushes_incomplete_trailing_utf8_on_stream_error():
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        raise RuntimeError("stream died")

    chunks = []
    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())

    # The stream raises before an end event, but the buffered bytes must still
    # be flushed as a replacement character before the error is surfaced.
    with pytest.raises(RuntimeError):
        for stdout, _, _ in handle:
            if stdout is not None:
                chunks.append(stdout)

    assert "".join(chunks) == "a�"


async def test_async_flushes_incomplete_trailing_utf8_on_stream_error():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        raise RuntimeError("stream died")

    chunks = []
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events(),
        on_stdout=chunks.append,
    )
    await handle._wait

    # The stream raised before an end event, but the buffered bytes must still
    # be flushed to the stdout callback as a replacement character.
    assert "".join(chunks) == "a�"
    assert isinstance(handle._iteration_exception, RuntimeError)
