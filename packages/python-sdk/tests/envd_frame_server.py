"""Frame-level HTTP/2 test harness for the envd RPC stack.

A real plaintext HTTP/2 server that records the frames the client sends
(notably ``RST_STREAM``), serving a Connect server stream the way envd's
process ``connect`` does, plus client factories mirroring the
``e2b.envd.client_sync``/``client_async`` wiring over a plaintext
transport. Tests drive it with the actual generated stubs wired with the
SDK's codec and interceptors. Not a test module itself — imported by the
``test_envd_*`` transport and stream test modules (``pythonpath = tests``
in pytest.ini makes it importable under ``--import-mode=importlib``).
"""

import contextlib
import logging
import socket
import struct
import threading
import time
from typing import Iterator, List, Optional

import h2.config
import h2.connection
import h2.errors
import h2.events
import h2.settings
from protobuf import Oneof
from pyqwest import (
    Client,
    HTTPTransport,
    HTTPVersion,
    SyncClient,
    SyncHTTPTransport,
    SyncTransport,
    Transport,
)

from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_HEALTH_ROUTE
from e2b.envd.client_shared import ENVD_JSON_CODEC, ENVD_RPC_COMPRESSION
from e2b.envd.interceptors import build_interceptors
from e2b.envd.process.process_connect import ProcessClient, ProcessClientSync
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
    but never answers, the way an unresponsive envd does. With
    ``plain_error=(status, content_type, body)`` it answers every request
    with that plain HTTP response, the way a gateway answering for envd does.
    """

    def __init__(
        self,
        server_ends_stream: bool,
        respond: bool = True,
        plain_error: Optional[tuple[int, str, bytes]] = None,
    ):
        super().__init__(daemon=True)
        self.server_ends_stream = server_ends_stream
        self.respond = respond
        self.plain_error = plain_error
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
                    if isinstance(event, h2.events.StreamEnded) and self.plain_error:
                        status, content_type, body = self.plain_error
                        conn.send_headers(
                            event.stream_id,
                            [
                                (":status", str(status)),
                                ("content-type", content_type),
                            ],
                        )
                        conn.send_data(event.stream_id, body, end_stream=True)
                    elif isinstance(event, h2.events.StreamEnded) and self.respond:
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
    server_ends_stream: bool,
    respond: bool = True,
    plain_error: Optional[tuple[int, str, bytes]] = None,
) -> Iterator[FrameRecordingServer]:
    server = FrameRecordingServer(server_ends_stream, respond, plain_error)
    server.start()
    try:
        yield server
    finally:
        server.listener.close()


class SharedPoolServer(threading.Thread):
    """Multi-connection plaintext HTTP/2 server for the shared-pool tests.

    Serves both sides of a sandbox's traffic — the process ``connect`` server
    stream and the envd HTTP ``/health`` route — so a single connection pool
    can be pointed at it the way the SDK points one at a real sandbox. After
    the first stream event it breaks the RPC the way a sandbox going away
    does:

    * ``fault="reset"`` sends ``RST_STREAM``, which kills the RPC stream and
      leaves the HTTP/2 connection healthy;
    * ``fault="drop"`` tears the whole TCP connection down with a RST.

    ``/health`` is always answered 200, so a probe that comes back anything
    but ``True`` failed at the transport layer. ``connections`` counts the
    accepted TCP connections, which is what tells reuse from a redial.
    """

    def __init__(self, fault: str):
        super().__init__(daemon=True)
        self.fault = fault
        self.listener = socket.create_server(("127.0.0.1", 0))
        self.listener.settimeout(10)
        self.port = self.listener.getsockname()[1]
        self.connections: List[socket.socket] = []
        self.paths: List[str] = []
        self.errors: List[str] = []
        self._lock = threading.Lock()
        # Set by the test in "drop" mode once it has consumed the event written
        # before the fault, so the RST cannot race the response head: an
        # immediate RST lets hyper fail the in-flight request with the
        # connection error instead of yielding the event it already received.
        self.drop_when = threading.Event()

    def run(self):
        while True:
            try:
                sock, _ = self.listener.accept()
            except (OSError, socket.timeout):
                # The listener was closed by the context manager, or nothing
                # else connected — either way there is nothing left to serve.
                return
            with self._lock:
                self.connections.append(sock)
            threading.Thread(target=self._serve, args=(sock,), daemon=True).start()

    def _serve(self, sock: socket.socket):
        sock.settimeout(0.1)
        conn = h2.connection.H2Connection(
            config=h2.config.H2Configuration(client_side=False)
        )
        conn.initiate_connection()
        sock.sendall(conn.data_to_send())
        paths: dict[int, str] = {}
        drop_connection = False
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
                    if isinstance(event, h2.events.RequestReceived):
                        path = dict(event.headers).get(b":path", b"").decode()
                        paths[event.stream_id] = path
                        with self._lock:
                            self.paths.append(path)
                    elif isinstance(event, h2.events.StreamEnded):
                        # The client finished sending the request: respond.
                        if paths.get(event.stream_id, "") == ENVD_API_HEALTH_ROUTE:
                            body = b'{"version":"0.0.0"}'
                            conn.send_headers(
                                event.stream_id,
                                [
                                    (":status", "200"),
                                    ("content-type", "application/json"),
                                    ("content-length", str(len(body))),
                                ],
                            )
                            conn.send_data(event.stream_id, body, end_stream=True)
                            continue
                        conn.send_headers(
                            event.stream_id,
                            [
                                (":status", "200"),
                                ("content-type", "application/connect+json"),
                            ],
                        )
                        conn.send_data(event.stream_id, event_envelope())
                        if self.fault == "reset":
                            conn.reset_stream(
                                event.stream_id,
                                error_code=h2.errors.ErrorCodes.INTERNAL_ERROR,
                            )
                        else:
                            drop_connection = True
                    elif isinstance(event, h2.events.DataReceived):
                        conn.acknowledge_received_data(
                            event.flow_controlled_length, event.stream_id
                        )
                    elif isinstance(event, h2.events.ConnectionTerminated):
                        return
                out = conn.data_to_send()
                if out:
                    sock.sendall(out)
                if drop_connection:
                    # Only tear the connection down once the client has read the
                    # event just written: an immediate RST races the response
                    # head, and hyper then fails the request itself instead of
                    # yielding the event.
                    self.drop_when.wait(5)
                    # RST the connection rather than closing it cleanly: a
                    # GOAWAY would tell the client to retire the connection,
                    # which is not what a sandbox disappearing looks like.
                    sock.setsockopt(
                        socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0)
                    )
                    return
        except Exception as e:  # noqa: BLE001 — surfaced via assert_no_errors
            self.errors.append(repr(e))
        finally:
            sock.close()

    def assert_no_errors(self):
        assert not self.errors, self.errors


@contextlib.contextmanager
def shared_pool_server(fault: str) -> Iterator[SharedPoolServer]:
    server = SharedPoolServer(fault)
    server.start()
    try:
        yield server
    finally:
        server.listener.close()


class StreamCapacityServer(threading.Thread):
    """HTTP/2 server that leaves response streams open at a small peer limit.

    Production ``sandbox.e2b.app`` currently advertises 100 concurrent streams.
    Tests reproduce that setting and prove how the SDK behaves once long-lived
    envd command streams fill one connection without opening hundreds of them.
    """

    def __init__(self, max_concurrent_streams: int):
        super().__init__(daemon=True)
        self.max_concurrent_streams = max_concurrent_streams
        self.listener = socket.create_server(("127.0.0.1", 0))
        self.listener.settimeout(0.1)
        self.port = self.listener.getsockname()[1]
        self.connections: List[socket.socket] = []
        self.streams: List[tuple[int, int]] = []
        self.active_streams: set[tuple[int, int]] = set()
        self.errors: List[str] = []
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

    def run(self):
        while not self._stop_event.is_set():
            try:
                sock, _ = self.listener.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            with self._lock:
                self.connections.append(sock)
            threading.Thread(target=self._serve, args=(sock,), daemon=True).start()

    def _serve(self, sock: socket.socket):
        sock.settimeout(0.1)
        conn = h2.connection.H2Connection(
            config=h2.config.H2Configuration(client_side=False)
        )
        conn.initiate_connection()
        conn.update_settings(
            {
                h2.settings.SettingCodes.MAX_CONCURRENT_STREAMS: (
                    self.max_concurrent_streams
                )
            }
        )
        sock.sendall(conn.data_to_send())
        try:
            while not self._stop_event.is_set():
                try:
                    data = sock.recv(65535)
                except socket.timeout:
                    continue
                except OSError:
                    return
                if not data:
                    return
                for event in conn.receive_data(data):
                    if isinstance(event, h2.events.StreamEnded):
                        with self._lock:
                            stream = (id(sock), event.stream_id)
                            self.streams.append(stream)
                            self.active_streams.add(stream)
                        conn.send_headers(
                            event.stream_id,
                            [
                                (":status", "200"),
                                ("content-type", "application/connect+json"),
                            ],
                        )
                        # Deliberately leave the response open: a running envd
                        # command holds its HTTP/2 stream for its whole lifetime.
                        conn.send_data(event.stream_id, event_envelope())
                    elif isinstance(event, h2.events.StreamReset):
                        with self._lock:
                            self.active_streams.discard((id(sock), event.stream_id))
                    elif isinstance(event, h2.events.DataReceived):
                        conn.acknowledge_received_data(
                            event.flow_controlled_length, event.stream_id
                        )
                    elif isinstance(event, h2.events.ConnectionTerminated):
                        return
                out = conn.data_to_send()
                if out:
                    sock.sendall(out)
        except Exception as e:  # noqa: BLE001 — surfaced via assert_no_errors
            self.errors.append(repr(e))
        finally:
            sock.close()

    def close(self):
        self._stop_event.set()
        self.listener.close()
        with self._lock:
            connections = list(self.connections)
        for sock in connections:
            with contextlib.suppress(OSError):
                sock.close()

    def assert_no_errors(self):
        assert not self.errors, self.errors


@contextlib.contextmanager
def stream_capacity_server(
    max_concurrent_streams: int,
) -> Iterator[StreamCapacityServer]:
    server = StreamCapacityServer(max_concurrent_streams)
    server.start()
    try:
        yield server
    finally:
        server.close()
        server.join(timeout=1)
        assert not server.is_alive()


def assert_stdout_event(event: ConnectResponse):
    assert event.event is not None
    match event.event.event:
        case Oneof(field="data", value=data):
            assert data.output == Oneof("stdout", b"hi")
        case other:
            raise AssertionError(f"expected a data event, got {other}")


def make_config(logger: Optional[logging.Logger] = None) -> ConnectionConfig:
    """A ``ConnectionConfig`` with a syntactically valid dummy API key."""
    return ConnectionConfig(api_key="e2b_" + "0" * 40, logger=logger)


# The factories in e2b.envd.client_sync/client_async use the shared TLS
# transports, which negotiate HTTP/2 via ALPN. The test server is plaintext,
# so these mirror the factories with an HTTP/2-prior-knowledge transport —
# pass `transport` to interpose a custom stack (retry middleware, plain-error
# normalization, ...). Return types stay unannotated on purpose: the stubs
# type server streams as Iterator/AsyncIterator, but the tests pin the
# close()/aclose() behavior of the real generators connectrpc returns.


def make_sync_client(
    port: int,
    transport: Optional[SyncTransport] = None,
    logger: Optional[logging.Logger] = None,
):
    base_url = f"http://127.0.0.1:{port}"
    return ProcessClientSync(
        base_url,
        codec=ENVD_JSON_CODEC,
        **ENVD_RPC_COMPRESSION,
        interceptors=build_interceptors(make_config(logger), base_url),
        http_client=SyncClient(
            transport or SyncHTTPTransport(http_version=HTTPVersion.HTTP2)
        ),
    )


def make_async_client(
    port: int,
    transport: Optional[Transport] = None,
    logger: Optional[logging.Logger] = None,
):
    base_url = f"http://127.0.0.1:{port}"
    return ProcessClient(
        base_url,
        codec=ENVD_JSON_CODEC,
        **ENVD_RPC_COMPRESSION,
        interceptors=build_interceptors(make_config(logger), base_url),
        http_client=Client(transport or HTTPTransport(http_version=HTTPVersion.HTTP2)),
    )
