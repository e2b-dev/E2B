import asyncio

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
    waiting for envd to close the HTTP stream, and the stream must be released."""
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
    await asyncio.wait_for(closed.wait(), timeout=5)
