"""Frame-level HTTP/2 test harness for the envd RPC stack.

A real plaintext HTTP/2 server that records the frames the client sends
(notably ``RST_STREAM``), serving a Connect server stream the way envd's
process ``connect`` does. Tests drive it with the actual generated stubs
wired with the SDK's codec and interceptors. Not a test module itself —
imported by ``test_envd_stream_reset`` and ``test_envd_retry_transport``
(``pythonpath = tests`` in pytest.ini makes it importable under
``--import-mode=importlib``).
"""

import contextlib
import socket
import struct
import threading
import time
from typing import Iterator

import h2.config
import h2.connection
import h2.events
from protobuf import Oneof

from e2b.envd.client_shared import ENVD_JSON_CODEC
from e2b.envd.process.process_pb import ConnectResponse, ProcessEvent

H2_CANCEL = 0x8
CONNECT_END_STREAM_FLAG = 0x02


def envelope(flags: int, data: bytes) -> bytes:
    return struct.pack(">BI", flags, len(data)) + data


def event_envelope() -> bytes:
    msg = ConnectResponse(
        event=ProcessEvent(
            event=Oneof("data", ProcessEvent.DataEvent(output=Oneof("stdout", b"hi")))
        )
    )
    return envelope(0, ENVD_JSON_CODEC.encode(msg))


class FrameRecordingServer(threading.Thread):
    """One-connection plaintext HTTP/2 server that records RST_STREAM frames.

    Replies to the first request with a single Connect message envelope and,
    when ``server_ends_stream`` is set, a Connect end-of-stream envelope with
    the HTTP/2 END_STREAM flag; otherwise it leaves the stream open the way a
    still-running process does. With ``respond=False`` it accepts the request
    but never answers, the way an unresponsive envd does.
    """

    def __init__(self, server_ends_stream: bool, respond: bool = True):
        super().__init__(daemon=True)
        self.server_ends_stream = server_ends_stream
        self.respond = respond
        self.listener = socket.create_server(("127.0.0.1", 0))
        self.listener.settimeout(10)
        self.port = self.listener.getsockname()[1]
        self.resets: list[tuple[int, int]] = []
        self.reset_event = threading.Event()
        self.errors: list[str] = []

    def run(self):
        try:
            sock, _ = self.listener.accept()
        except socket.timeout:
            self.errors.append("client never connected")
            return
        sock.settimeout(0.1)
        conn = h2.connection.H2Connection(
            config=h2.config.H2Configuration(client_side=False)
        )
        conn.initiate_connection()
        sock.sendall(conn.data_to_send())
        deadline = time.monotonic() + 10
        try:
            while time.monotonic() < deadline:
                try:
                    data = sock.recv(65535)
                except socket.timeout:
                    continue
                except OSError:
                    break
                if not data:
                    break
                for event in conn.receive_data(data):
                    if isinstance(event, h2.events.StreamEnded) and self.respond:
                        # The client finished sending the request: respond.
                        conn.send_headers(
                            event.stream_id,
                            [
                                (":status", "200"),
                                ("content-type", "application/connect+json"),
                            ],
                        )
                        conn.send_data(event.stream_id, event_envelope())
                        if self.server_ends_stream:
                            conn.send_data(
                                event.stream_id,
                                envelope(CONNECT_END_STREAM_FLAG, b"{}"),
                                end_stream=True,
                            )
                    elif isinstance(event, h2.events.DataReceived):
                        conn.acknowledge_received_data(
                            event.flow_controlled_length, event.stream_id
                        )
                    elif isinstance(event, h2.events.StreamReset):
                        self.resets.append((event.stream_id, int(event.error_code)))
                        self.reset_event.set()
                    elif isinstance(event, h2.events.ConnectionTerminated):
                        return
                out = conn.data_to_send()
                if out:
                    sock.sendall(out)
        except Exception as e:  # noqa: BLE001 — surfaced via assert_no_errors
            self.errors.append(repr(e))
        finally:
            sock.close()

    def assert_reset_sent(self):
        assert not self.errors, self.errors
        assert self.reset_event.wait(3), "no RST_STREAM within 3s"
        assert self.resets == [(1, H2_CANCEL)]

    def assert_no_reset_sent(self):
        # Grace period: a spurious reset would arrive within this window.
        self.reset_event.wait(0.5)
        assert not self.errors, self.errors
        assert self.resets == []


@contextlib.contextmanager
def frame_recording_server(
    server_ends_stream: bool, respond: bool = True
) -> Iterator[FrameRecordingServer]:
    server = FrameRecordingServer(server_ends_stream, respond)
    server.start()
    try:
        yield server
    finally:
        server.listener.close()


def assert_stdout_event(event: ConnectResponse):
    assert event.event is not None
    match event.event.event:
        case Oneof(field="data", value=data):
            assert data.output == Oneof("stdout", b"hi")
        case other:
            raise AssertionError(f"expected a data event, got {other}")
