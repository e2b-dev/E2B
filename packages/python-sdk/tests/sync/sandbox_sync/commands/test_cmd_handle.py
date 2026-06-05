import threading
import time

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


def test_wait_stops_at_end_event_even_if_stream_stays_open():
    """`wait()` must return as soon as the terminal end event arrives, without
    waiting for envd to close the HTTP stream, and the stream must be released."""
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

    result_box = {}

    def run():
        result_box["result"] = handle.wait()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    thread.join(timeout=5)

    assert not thread.is_alive(), "wait() did not return; iterator did not stop"
    assert result_box["result"].exit_code == 0
    assert result_box["result"].stdout == "hello"
    assert closed.wait(timeout=5)
