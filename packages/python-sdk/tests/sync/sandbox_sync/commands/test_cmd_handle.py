import threading
import time

import pytest

from e2b.envd.process import process_pb2
from e2b.sandbox_sync.commands.command_handle import CommandHandle


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


def _wait_in_thread(handle: CommandHandle, timeout: float = 5):
    result_box = {}
    error_box = {}

    def run():
        try:
            result_box["result"] = handle.wait()
        except Exception as e:  # noqa: BLE001
            error_box["error"] = e

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    assert not thread.is_alive(), "wait() did not return; iterator did not stop"

    if "error" in error_box:
        raise error_box["error"]

    return result_box["result"]


def test_wait_stops_at_end_event_even_if_stream_stays_open():
    """`wait()` must return as soon as the terminal end event arrives, without
    waiting for envd to close the HTTP stream."""
    closed = threading.Event()

    def events():
        try:
            yield _data_event(b"hello")
            yield _end_event(0)
            # Simulate envd delaying the HTTP stream close indefinitely.
            time.sleep(3600)
        finally:
            closed.set()

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())

    result = _wait_in_thread(handle)

    assert result.exit_code == 0
    assert result.stdout == "hello"
    # The underlying stream/connection must be released promptly (not at GC).
    assert closed.wait(timeout=5)


def test_iteration_exception_releases_stream():
    """An exception raised while iterating must still release the stream and
    surface through `wait()`."""
    closed = threading.Event()

    def events():
        try:
            yield _data_event(b"hello")
            raise RuntimeError("boom")
        finally:
            closed.set()

    handle = CommandHandle(pid=1, handle_kill=lambda: True, events=events())

    with pytest.raises(Exception):
        _wait_in_thread(handle)

    assert closed.wait(timeout=5)
