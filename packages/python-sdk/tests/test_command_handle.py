import asyncio
import sys
from typing import Any, cast

import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from envd_frame_server import (
    frame_recording_server,
    make_async_client,
    make_sync_client,
)

from protobuf import Oneof

from e2b.envd.process import process_pb
from e2b.exceptions import SandboxException
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


async def _raised(awaitable) -> BaseException:
    try:
        await awaitable
    except BaseException as e:
        return e
    raise AssertionError("expected the awaitable to raise")


# The disconnect tests run the handle on a real envd-style server stream (see
# `envd_frame_server`): one stdout event, then the stream stays open the way a
# still-running process does.


async def test_async_wait_raises_sandbox_exception_after_disconnect():
    with frame_recording_server(server_ends_stream=False) as server:
        got_stdout = asyncio.Event()
        handle = AsyncCommandHandle(
            pid=1,
            handle_kill=_kill,
            events=make_async_client(server.port).connect(process_pb.ConnectRequest()),
            on_stdout=lambda _: got_stdout.set(),
        )
        await got_stdout.wait()

        waiting = asyncio.create_task(handle.wait())
        await asyncio.sleep(0)
        await handle.disconnect()

        # Both a wait() pending at the disconnect and a later one get a
        # catchable SandboxException instead of a CancelledError leaking into
        # a task nobody cancelled.
        for err in (await _raised(waiting), await _raised(handle.wait())):
            assert isinstance(err, SandboxException), repr(err)
            assert "disconnected before the command finished" in str(err).lower()
        assert not waiting.cancelled()


async def test_async_wait_raises_sandbox_exception_after_disconnect_in_callback():
    # Here disconnect() cancels the event task while it awaits the callback,
    # not the stream read.
    with frame_recording_server(server_ends_stream=False) as server:
        in_callback = asyncio.Event()

        async def on_stdout(_):
            in_callback.set()
            await asyncio.Event().wait()

        handle = AsyncCommandHandle(
            pid=1,
            handle_kill=_kill,
            events=make_async_client(server.port).connect(process_pb.ConnectRequest()),
            on_stdout=on_stdout,
        )
        await in_callback.wait()
        await handle.disconnect()

        err = await _raised(handle.wait())
        assert isinstance(err, SandboxException), repr(err)


async def test_async_cancelling_the_waiter_still_cancels_it():
    with frame_recording_server(server_ends_stream=False) as server:
        got_stdout = asyncio.Event()
        handle = AsyncCommandHandle(
            pid=1,
            handle_kill=_kill,
            events=make_async_client(server.port).connect(process_pb.ConnectRequest()),
            on_stdout=lambda _: got_stdout.set(),
        )
        await got_stdout.wait()

        waiting = asyncio.create_task(handle.wait())
        await asyncio.sleep(0)
        waiting.cancel()

        assert isinstance(await _raised(waiting), asyncio.CancelledError)
        await handle.disconnect()


@pytest.mark.skipif(
    sys.version_info < (3, 11), reason="needs Task.cancelling() (Python 3.11+)"
)
async def test_async_cancelling_the_waiter_together_with_disconnect_still_cancels_it():
    with frame_recording_server(server_ends_stream=False) as server:
        got_stdout = asyncio.Event()
        handle = AsyncCommandHandle(
            pid=1,
            handle_kill=_kill,
            events=make_async_client(server.port).connect(process_pb.ConnectRequest()),
            on_stdout=lambda _: got_stdout.set(),
        )
        await got_stdout.wait()

        waiting = asyncio.create_task(handle.wait())
        await asyncio.sleep(0)
        waiting.cancel()
        await handle.disconnect()

        assert isinstance(await _raised(waiting), asyncio.CancelledError)
        assert waiting.cancelled()


def test_sync_wait_raises_sandbox_exception_after_disconnect():
    with frame_recording_server(server_ends_stream=False) as server:
        handle = CommandHandle(
            pid=1,
            handle_kill=lambda: True,
            events=make_sync_client(server.port).connect(process_pb.ConnectRequest()),
        )
        assert next(iter(handle)) == ("hi", None, None)
        handle.disconnect()

        with pytest.raises(
            SandboxException, match="(?i)disconnected before the command finished"
        ):
            handle.wait()


def test_sync_disconnect_from_a_callback_makes_wait_raise_sandbox_exception():
    with frame_recording_server(server_ends_stream=False) as server:
        handle = CommandHandle(
            pid=1,
            handle_kill=lambda: True,
            events=make_sync_client(server.port).connect(process_pb.ConnectRequest()),
        )

        with pytest.raises(
            SandboxException, match="(?i)disconnected before the command finished"
        ):
            handle.wait(on_stdout=lambda _: handle.disconnect())


def test_sync_failed_disconnect_leaves_the_handle_connected():
    # close() fails while the stream generator is executing (e.g. disconnect()
    # from another thread during a read), so the handle stays connected and a
    # stream ending without an end event is not reported as a disconnect.
    handle: CommandHandle

    def events():
        with pytest.raises(ValueError):
            handle.disconnect()
        yield _stdout_event(b"a")

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())

    with pytest.raises(Exception, match="Command ended without an end event"):
        handle.wait()


async def test_async_disconnect_keeps_buffered_bytes_in_stdout_without_a_callback():
    async def events():
        yield _stdout_event(b"a" + EMOJI_BYTES[:2])
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError as e:
            # What connectrpc does with a cancelled read.
            raise ConnectError(Code.CANCELED, "cancelled") from e

    chunks = []
    got_stdout = asyncio.Event()

    def on_stdout(out):
        chunks.append(out)
        got_stdout.set()

    handle = AsyncCommandHandle(
        pid=1, handle_kill=_kill, events=events(), on_stdout=on_stdout
    )
    await got_stdout.wait()
    await handle.disconnect()

    assert handle.stdout == "a�"
    assert chunks == ["a"]
