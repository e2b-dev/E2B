"""
Server streams closed before the server ends them must cancel the HTTP/2
stream (``RST_STREAM`` CANCEL) so envd tears the stream down server-side.

A stream that is merely abandoned stays attached to envd's process output
fan-out and, once its flow-control window fills, blocks output delivery for
every other consumer of the same process on the shared connection (#1352,
#1587). The previous httpcore-based transport had exactly that bug; on this
stack the cancellation comes from pyqwest (hyper), and these tests pin the
behavior at the frame level: a real plaintext HTTP/2 server records the
frames the client sends, and the client is the actual generated stub wired
with the SDK's codec and interceptors, as built by the
``e2b.envd.client_sync``/``client_async`` factories.
"""

import contextlib
import logging
import socket
import struct
import threading
import time
from typing import Iterator, Optional

import h2.config
import h2.connection
import h2.events
import pytest
from protobuf import Oneof
from pyqwest import (
    Client,
    HTTPTransport,
    HTTPVersion,
    SyncClient,
    SyncHTTPTransport,
)

from e2b.connection_config import ConnectionConfig
from e2b.envd.client_async import first_event
from e2b.envd.client_shared import ENVD_JSON_CODEC
from e2b.exceptions import TimeoutException
from e2b.envd.interceptors import build_interceptors
from e2b.envd.process.process_connect import ProcessClient, ProcessClientSync
from e2b.envd.process.process_pb import ConnectRequest, ConnectResponse, ProcessEvent

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


def _config(logger: Optional[logging.Logger]) -> ConnectionConfig:
    return ConnectionConfig(api_key="e2b_" + "0" * 40, logger=logger)


# The factories in e2b.envd.client_sync/client_async use the shared TLS
# transports, which negotiate HTTP/2 via ALPN. The test server is plaintext,
# so mirror the factories with an HTTP/2-prior-knowledge transport instead.


def make_sync_client(port: int, logger: Optional[logging.Logger] = None):
    base_url = f"http://127.0.0.1:{port}"
    return ProcessClientSync(
        base_url,
        codec=ENVD_JSON_CODEC,
        send_compression=None,
        accept_compression=(),
        interceptors=build_interceptors(_config(logger), base_url),
        http_client=SyncClient(SyncHTTPTransport(http_version=HTTPVersion.HTTP2)),
    )


def make_async_client(port: int, logger: Optional[logging.Logger] = None):
    base_url = f"http://127.0.0.1:{port}"
    return ProcessClient(
        base_url,
        codec=ENVD_JSON_CODEC,
        send_compression=None,
        accept_compression=(),
        interceptors=build_interceptors(_config(logger), base_url),
        http_client=Client(HTTPTransport(http_version=HTTPVersion.HTTP2)),
    )


def assert_stdout_event(event: ConnectResponse):
    assert event.event is not None
    match event.event.event:
        case Oneof(field="data", value=data):
            assert data.output == Oneof("stdout", b"hi")
        case other:
            raise AssertionError(f"expected a data event, got {other}")


def test_sync_early_close_sends_rst_stream():
    with frame_recording_server(server_ends_stream=False) as server:
        events = make_sync_client(server.port).connect(ConnectRequest())
        assert_stdout_event(next(events))
        assert server.resets == []
        events.close()  # what CommandHandle.disconnect() does
        server.assert_reset_sent()


def test_sync_completed_stream_does_not_send_rst_stream():
    with frame_recording_server(server_ends_stream=True) as server:
        events = list(make_sync_client(server.port).connect(ConnectRequest()))
        assert len(events) == 1
        server.assert_no_reset_sent()


def test_sync_early_close_propagates_through_logging_interceptor():
    # The logging interceptor wraps the stream in another generator; closing
    # the outer one must still cancel the underlying HTTP/2 stream.
    with frame_recording_server(server_ends_stream=False) as server:
        client = make_sync_client(server.port, logger=logging.getLogger("test.reset"))
        events = client.connect(ConnectRequest())
        assert_stdout_event(next(events))
        events.close()
        server.assert_reset_sent()


def test_sync_abandoned_stream_sends_rst_stream():
    # No close() at all — dropping the last reference must still cancel the
    # stream (refcount finalization closes the generator chain).
    with frame_recording_server(server_ends_stream=False) as server:
        events = make_sync_client(server.port).connect(ConnectRequest())
        assert_stdout_event(next(events))
        del events
        server.assert_reset_sent()


async def test_async_early_close_sends_rst_stream():
    with frame_recording_server(server_ends_stream=False) as server:
        events = make_async_client(server.port).connect(ConnectRequest())
        assert_stdout_event(await events.__anext__())
        assert server.resets == []
        await events.aclose()  # what AsyncCommandHandle.disconnect() does
        server.assert_reset_sent()


async def test_async_completed_stream_does_not_send_rst_stream():
    with frame_recording_server(server_ends_stream=True) as server:
        events = [
            event
            async for event in make_async_client(server.port).connect(ConnectRequest())
        ]
        assert len(events) == 1
        server.assert_no_reset_sent()


async def test_async_early_close_propagates_through_logging_interceptor():
    with frame_recording_server(server_ends_stream=False) as server:
        client = make_async_client(server.port, logger=logging.getLogger("test.reset"))
        events = client.connect(ConnectRequest())
        assert_stdout_event(await events.__anext__())
        await events.aclose()
        server.assert_reset_sent()


async def test_async_setup_timeout_sends_rst_stream():
    # `request_timeout` expiring while envd never answers (see
    # test_envd_stream_request_timeout) must tear the HTTP/2 stream down,
    # not leave it attached to the shared connection.
    with frame_recording_server(server_ends_stream=False, respond=False) as server:
        events = make_async_client(server.port).connect(ConnectRequest())
        with pytest.raises(TimeoutException, match="request_timeout"):
            await first_event(events, 0.3)
        await events.aclose()  # what the call sites do next; must be a no-op
        server.assert_reset_sent()
