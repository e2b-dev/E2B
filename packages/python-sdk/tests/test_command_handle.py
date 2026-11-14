import asyncio
from typing import Any, Callable, cast

import pytest

from protobuf import Oneof

from e2b.envd.process import process_pb
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.sandbox_async.commands.command_handle import AsyncCommandHandle
from e2b.sandbox_sync.commands.command_handle import CommandHandle

EMOJI = "😀"
EMOJI_BYTES = EMOJI.encode("utf-8")  # 4 bytes


def _stdout_event(data: bytes) -> process_pb.StartResponse:
    return process_pb.StartResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "data", process_pb.ProcessEvent.DataEvent(output=Oneof("stdout", data))
            )
        )
    )


def _stderr_event(data: bytes) -> process_pb.StartResponse:
    return process_pb.StartResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "data", process_pb.ProcessEvent.DataEvent(output=Oneof("stderr", data))
            )
        )
    )


def _pty_event(data: bytes) -> process_pb.StartResponse:
    return process_pb.StartResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "data", process_pb.ProcessEvent.DataEvent(output=Oneof("pty", data))
            )
        )
    )


def _end_event(exit_code: int = 0) -> process_pb.StartResponse:
    return process_pb.StartResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "end",
                process_pb.ProcessEvent.EndEvent(
                    exit_code=exit_code, exited=True, status="exited"
                ),
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
        # The handle only async-iterates and aclose()s the stream; this stand-in
        # satisfies both without being a real async generator.
        events=cast(Any, events),
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


@pytest.mark.parametrize(
    "output,event_factory",
    [("stdout", _stdout_event), ("stderr", _stderr_event), ("pty", _pty_event)],
)
@pytest.mark.parametrize("callback_task", [False, True], ids=["direct", "task"])
async def test_async_disconnect_returns_from_output_callback(
    output: str,
    event_factory: Callable[[bytes], process_pb.StartResponse],
    callback_task: bool,
):
    closed = asyncio.Event()
    disconnect_returned = False
    reached_late_output = False
    chunks: list[str | bytes] = []
    data = b"a" + EMOJI_BYTES[:2]

    async def events():
        nonlocal reached_late_output
        try:
            yield event_factory(data)
            reached_late_output = True
            yield event_factory(b"late")
            yield _end_event()
        finally:
            await asyncio.sleep(0)
            closed.set()

    async def on_output(chunk: str | bytes):
        nonlocal disconnect_returned
        chunks.append(chunk)
        await handle.disconnect()
        assert closed.is_set()
        await asyncio.sleep(0)
        disconnect_returned = True

    def start_output_task(chunk: str | bytes):
        return asyncio.create_task(on_output(chunk))

    callback = start_output_task if callback_task else on_output
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events(),
        on_stdout=callback if output == "stdout" else None,
        on_stderr=callback if output == "stderr" else None,
        on_pty=callback if output == "pty" else None,
    )
    try:
        await asyncio.wait_for(asyncio.shield(handle._wait), timeout=1)
        assert disconnect_returned
        assert closed.is_set()
        assert not reached_late_output
        assert chunks == [data if output == "pty" else "a"]
        if output == "stdout":
            assert handle.stdout == "a"
        elif output == "stderr":
            assert handle.stderr == "a"
    finally:
        await handle.disconnect()


async def test_async_disconnect_allows_active_callback_to_finish():
    callback_started = asyncio.Event()
    release_callback = asyncio.Event()
    callback_finished = asyncio.Event()
    closed = asyncio.Event()
    chunks = []

    async def events():
        try:
            yield _stdout_event(b"a")
            yield _stdout_event(b"late")
            yield _end_event()
        finally:
            await asyncio.sleep(0)
            closed.set()

    async def on_stdout(chunk: str):
        chunks.append(chunk)
        callback_started.set()
        await release_callback.wait()
        callback_finished.set()

    handle = AsyncCommandHandle(
        pid=1, handle_kill=_kill, events=events(), on_stdout=on_stdout
    )
    try:
        await asyncio.wait_for(callback_started.wait(), timeout=1)
        await asyncio.wait_for(handle.disconnect(), timeout=1)
        assert closed.is_set()
        assert not callback_finished.is_set()
        release_callback.set()
        await asyncio.wait_for(asyncio.shield(handle._wait), timeout=1)
        assert callback_finished.is_set()
        assert chunks == ["a"]
    finally:
        release_callback.set()
        await handle.disconnect()


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


def test_sync_records_result_before_yielding_flushed_chunk():
    # A consumer that stops iterating right after the end event's flushed chunk
    # must still observe the exit code: the result is recorded before the
    # flushed chunk is yielded.
    def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        yield _end_event(0)

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())
    iterator = iter(handle)
    assert next(iterator) == ("a", None, None)
    # The end event flushes a trailing replacement character; pull just that
    # chunk and then stop iterating.
    next(iterator)
    iterator.close()

    assert handle._result is not None
    assert handle._result.exit_code == 0
    assert handle._result.stdout == "a�"


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


def test_sync_does_not_retain_output():
    def events():
        yield _stdout_event(b"out")
        yield _stderr_event(b"err")
        yield _end_event()

    stdout = []
    stderr = []
    handle = CommandHandle(
        pid=1, handle_kill=lambda: True, events=events(), retain_output=False
    )
    result = handle.wait(on_stdout=stdout.append, on_stderr=stderr.append)

    assert result.exit_code == 0
    assert result.stdout is None
    assert result.stderr is None
    assert stdout == ["out"]
    assert stderr == ["err"]


def test_sync_exit_exception_without_retained_output():
    def events():
        yield _stderr_event(b"err")
        yield _end_event(1)

    handle = CommandHandle(
        pid=1, handle_kill=lambda: True, events=events(), retain_output=False
    )
    with pytest.raises(CommandExitException) as exc_info:
        handle.wait()

    assert exc_info.value.exit_code == 1
    assert exc_info.value.stdout is None
    assert exc_info.value.stderr is None
    assert str(exc_info.value) == "Command exited with code 1"


async def test_async_does_not_retain_output():
    async def events():
        yield _stdout_event(b"out")
        yield _stderr_event(b"err")
        yield _end_event()

    stdout = []
    handle = AsyncCommandHandle(
        pid=1,
        handle_kill=_kill,
        events=events(),
        on_stdout=stdout.append,
        retain_output=False,
    )
    result = await handle.wait()

    assert result.exit_code == 0
    assert result.stdout is None
    assert result.stderr is None
    assert handle.stdout is None
    assert handle.stderr is None
    assert stdout == ["out"]


async def test_async_exit_exception_without_retained_output():
    async def events():
        yield _stderr_event(b"err")
        yield _end_event(1)

    handle = AsyncCommandHandle(
        pid=1, handle_kill=_kill, events=events(), retain_output=False
    )
    with pytest.raises(CommandExitException) as exc_info:
        await handle.wait()

    assert exc_info.value.stdout is None
    assert exc_info.value.stderr is None
