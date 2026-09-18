import asyncio
from typing import Any, List, Literal, Optional, cast

import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from protobuf import Oneof
from pyqwest import StreamError, StreamErrorCode

from e2b.envd.process import process_pb
from e2b.sandbox.commands.command_handle import CommandExitException
from e2b.sandbox.commands.resume import (
    CommandOutputLostException,
    OutputPosition,
    extract_start_offsets,
)
from e2b.sandbox_async.commands.command_handle import AsyncCommandHandle
from e2b.sandbox_async.commands.resume import AsyncResumableEvents
from e2b.sandbox_sync.commands.command_handle import CommandHandle
from e2b.sandbox_sync.commands.resume import ResumableEvents


def _start(offsets: Optional[process_pb.OutputOffsets] = None):
    return process_pb.ConnectResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "start", process_pb.ProcessEvent.StartEvent(pid=1, offsets=offsets)
            )
        )
    )


def _data(
    stream: Literal["stdout", "stderr", "pty"],
    data: bytes,
    offset: Optional[int] = None,
):
    output = cast(Any, Oneof(stream, data))
    return process_pb.ConnectResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "data",
                process_pb.ProcessEvent.DataEvent(output=output, offset=offset),
            )
        )
    )


def _end(exit_code: int = 0):
    return process_pb.ConnectResponse(
        event=process_pb.ProcessEvent(
            event=Oneof(
                "end",
                process_pb.ProcessEvent.EndEvent(
                    exit_code=exit_code, exited=True, status="exited"
                ),
            )
        )
    )


def _dropped() -> ConnectError:
    e = ConnectError(Code.UNKNOWN, "terminated")
    e.__cause__ = StreamError("stream reset", StreamErrorCode.INTERNAL_ERROR)
    return e


def _unavailable() -> ConnectError:
    return ConnectError(Code.UNAVAILABLE, "unavailable")


def _events(*items):
    """Sync stream yielding ``items``; an exception instance is raised in place."""
    for item in items:
        if isinstance(item, BaseException):
            raise item
        yield item


async def _aevents(*items):
    for item in items:
        if isinstance(item, BaseException):
            raise item
        yield item


class _Server:
    """Scripted envd: each ``connect`` pops the next canned stream and records
    the requested resume offsets."""

    def __init__(self, streams: List[Any]):
        self._streams = list(streams)
        self.resume_from: List[process_pb.OutputOffsets] = []
        self.timeouts: List[Optional[int]] = []

    def connect(self, resume_from, timeout_ms):
        self.resume_from.append(resume_from)
        self.timeouts.append(timeout_ms)
        nxt = self._streams.pop(0)
        return nxt() if callable(nxt) else nxt


def _resumable(server, first, timeout=None, **kw):
    start = next(first)
    return ResumableEvents(
        first,
        extract_start_offsets(start),
        server.connect,
        timeout,
        sleep=lambda _s: None,
        **kw,
    )


def _collect(events):
    return [e.event.event for e in events]


def test_offset_tracking_uses_explicit_offsets_and_falls_back():
    pos = OutputPosition()
    pos.advance(_data("stdout", b"abc"))
    pos.advance(_data("stderr", b"12345", offset=10))
    pos.advance(_data("pty", b"xy"))
    assert (pos.stdout, pos.stderr, pos.pty) == (3, 15, 2)
    assert pos.to_offsets().stderr == 15


def test_extract_start_offsets_absent_on_legacy_envd():
    assert extract_start_offsets(_start()) is None
    got = extract_start_offsets(_start(process_pb.OutputOffsets(stdout=7)))
    assert got == OutputPosition(stdout=7)


def test_sync_reconnects_without_duplicates():
    server = _Server(
        [
            lambda: _events(
                _start(process_pb.OutputOffsets(stdout=3, stderr=2)),
                _data("stdout", b"def", offset=3),
                _end(),
            )
        ]
    )
    events = _resumable(
        server,
        _events(
            _start(process_pb.OutputOffsets()),
            _data("stdout", b"abc", offset=0),
            _data("stderr", b"12", offset=0),
            _dropped(),
        ),
    )
    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events)
    result = handle.wait()
    assert result.stdout == "abcdef"
    assert result.stderr == "12"
    assert len(server.resume_from) == 1
    assert (server.resume_from[0].stdout, server.resume_from[0].stderr) == (3, 2)


def test_sync_resume_starts_from_connect_baseline():
    server = _Server([lambda: _events(_start(), _end())])
    events = _resumable(
        server,
        _events(
            _start(process_pb.OutputOffsets(stdout=100, pty=5)),
            _data("pty", b"zz", offset=5),
            _dropped(),
        ),
    )
    _collect(events)
    assert (server.resume_from[0].stdout, server.resume_from[0].pty) == (100, 7)


def test_sync_retries_transient_errors_then_gives_up():
    server = _Server([lambda: _events(_unavailable())] * 3)
    events = _resumable(
        server,
        _events(_start(process_pb.OutputOffsets()), _dropped()),
        max_attempts=3,
    )
    with pytest.raises(ConnectError) as info:
        _collect(events)
    assert info.value.code is Code.UNAVAILABLE
    assert len(server.resume_from) == 3


def test_sync_exit_during_reconnect_is_delivered():
    server = _Server(
        [
            lambda: _events(_unavailable()),
            lambda: _events(_start(), _data("stdout", b"tail", offset=3), _end(7)),
        ]
    )
    events = _resumable(
        server,
        _events(
            _start(process_pb.OutputOffsets()),
            _data("stdout", b"abc"),
            _dropped(),
        ),
    )
    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events)
    with pytest.raises(CommandExitException) as info:
        handle.wait()
    assert info.value.exit_code == 7
    assert info.value.stdout == "abctail"
    assert len(server.resume_from) == 2


def test_sync_replay_window_exhausted_raises_output_lost():
    server = _Server([lambda: _events(ConnectError(Code.OUT_OF_RANGE, "evicted"))])
    events = _resumable(server, _events(_start(process_pb.OutputOffsets()), _dropped()))
    with pytest.raises(CommandOutputLostException):
        _collect(events)


def test_sync_legacy_envd_does_not_reconnect():
    server = _Server([])
    events = _resumable(server, _events(_start(), _dropped()))
    with pytest.raises(ConnectError):
        _collect(events)
    assert server.resume_from == []


def test_sync_non_transient_error_is_not_retried():
    server = _Server([])
    events = _resumable(
        server,
        _events(
            _start(process_pb.OutputOffsets()),
            ConnectError(Code.DEADLINE_EXCEEDED, "deadline"),
        ),
    )
    with pytest.raises(ConnectError) as info:
        _collect(events)
    assert info.value.code is Code.DEADLINE_EXCEEDED
    assert server.resume_from == []


def test_sync_sandbox_gone_stops_reconnect():
    server = _Server([lambda: _events(_start(), _end())])
    events = _resumable(
        server,
        _events(_start(process_pb.OutputOffsets()), _dropped()),
        check_health=lambda: False,
    )
    with pytest.raises(ConnectError):
        _collect(events)
    assert server.resume_from == []


def test_sync_close_during_backoff_stops_reconnect():
    server = _Server([lambda: _events(_start(), _end())])
    first = _events(_start(process_pb.OutputOffsets()), _dropped())
    start = next(first)
    holder: List[ResumableEvents] = []
    events = ResumableEvents(
        first,
        extract_start_offsets(start),
        server.connect,
        None,
        sleep=lambda _s: holder[0].close(),
    )
    holder.append(events)
    with pytest.raises(ConnectError):
        _collect(events)
    assert server.resume_from == []


def test_sync_reconnect_respects_stream_deadline():
    server = _Server([lambda: _events(_start(), _end())])
    events = _resumable(
        server,
        _events(_start(process_pb.OutputOffsets()), _dropped()),
        timeout=30,
    )
    _collect(events)
    assert server.timeouts[0] is not None
    assert 0 < server.timeouts[0] <= 30_000


async def _aresumable(server, first, timeout=None, backoff=0.0, **kw):
    start = await first.__anext__()
    return AsyncResumableEvents(
        first,
        extract_start_offsets(start),
        server.connect,
        timeout,
        backoff=backoff,
        **kw,
    )


async def test_async_reconnects_without_duplicates():
    server = _Server(
        [
            lambda: _aevents(
                _start(process_pb.OutputOffsets(stdout=3)),
                _data("stdout", b"def", offset=3),
                _end(),
            )
        ]
    )
    events = await _aresumable(
        server,
        _aevents(
            _start(process_pb.OutputOffsets()),
            _data("stdout", b"abc", offset=0),
            _dropped(),
        ),
    )

    async def kill():
        return True

    handle = AsyncCommandHandle(pid=1, handle_kill=kill, events=events)
    result = await handle.wait()
    assert result.stdout == "abcdef"
    assert server.resume_from[0].stdout == 3


async def test_async_replay_window_exhausted_raises_output_lost():
    server = _Server([lambda: _aevents(ConnectError(Code.OUT_OF_RANGE, "evicted"))])
    events = await _aresumable(
        server, _aevents(_start(process_pb.OutputOffsets()), _dropped())
    )
    with pytest.raises(CommandOutputLostException):
        async for _ in events:
            pass


async def test_async_disconnect_during_backoff_stops_reconnect():
    server = _Server([lambda: _aevents(_start(), _end())])
    events = await _aresumable(
        server,
        _aevents(_start(process_pb.OutputOffsets()), _dropped()),
        backoff=10,
    )

    async def kill():
        return True

    handle = AsyncCommandHandle(pid=1, handle_kill=kill, events=events)
    await asyncio.sleep(0.05)
    await handle.disconnect()
    assert server.resume_from == []


async def test_async_legacy_envd_does_not_reconnect():
    server = _Server([])
    events = await _aresumable(server, _aevents(_start(), _dropped()))
    with pytest.raises(ConnectError):
        async for _ in events:
            pass
    assert server.resume_from == []


async def test_async_exit_during_reconnect_is_delivered():
    server = _Server(
        [
            lambda: _aevents(_unavailable()),
            lambda: _aevents(_start(), _data("stdout", b"tail", offset=3), _end(7)),
        ]
    )
    events = await _aresumable(
        server,
        _aevents(
            _start(process_pb.OutputOffsets()),
            _data("stdout", b"abc"),
            _dropped(),
        ),
        max_attempts=3,
    )

    async def kill():
        return True

    handle = AsyncCommandHandle(pid=1, handle_kill=kill, events=events)
    with pytest.raises(CommandExitException) as info:
        await handle.wait()
    assert info.value.exit_code == 7
    assert info.value.stdout == "abctail"
    assert len(server.resume_from) == 2
