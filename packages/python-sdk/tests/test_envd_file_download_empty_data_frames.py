"""File downloads must survive a peer that pads responses with empty DATA frames.

The sandbox proxy splits envd file downloads into HTTP/2 DATA frames with an
empty, non-final one after every ~32 KiB. h2 (under pyqwest) counts those over
the lifetime of a connection and tears the whole connection down with
``ENHANCE_YOUR_CALM`` (``too_many_data_frames``) after 100 of them, so a few
MB read over HTTP/2 always failed, and smaller reads failed once a pooled
connection had accumulated the count. ``files.read`` therefore downloads over
HTTP/1.1. The server here answers HTTP/2 (prior knowledge, standing in for
ALPN against the real proxy) the way the proxy does, and plain HTTP/1.1
otherwise.
"""

import contextlib
import socket
import threading
from typing import Iterator, List

import h2.config
import h2.connection
import h2.events
import pytest
from packaging.version import Version
from pyqwest import HTTPVersion

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
from e2b.connection_config import ConnectionConfig
from e2b.sandbox_async.filesystem.filesystem import Filesystem as AsyncFilesystem
from e2b.sandbox_sync.filesystem.filesystem import Filesystem
from transport_caches import reset_transport_caches

H2_PREFACE = b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"
# Comfortably past h2's limit of 100 empty DATA frames per connection, with
# chunks large enough not to touch its separate small-frame budget and a body
# that fits the default flow-control windows.
CHUNKS = [bytes([ord("a") + i % 26]) * 300 for i in range(150)]
CONTENT = b"".join(CHUNKS)


class EmptyDataFramesServer(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.listener = socket.create_server(("127.0.0.1", 0))
        self.port = self.listener.getsockname()[1]
        self.protocols: List[str] = []

    def run(self):
        while True:
            try:
                sock, _ = self.listener.accept()
            except OSError:
                return
            threading.Thread(target=self.serve, args=(sock,), daemon=True).start()

    def serve(self, sock: socket.socket):
        sock.settimeout(10)
        try:
            head = sock.recv(len(H2_PREFACE), socket.MSG_PEEK | socket.MSG_WAITALL)
            if head == H2_PREFACE:
                self.serve_h2(sock)
            else:
                self.serve_h1(sock)
        except OSError:
            pass
        finally:
            sock.close()

    def serve_h1(self, sock: socket.socket):
        buf = b""
        while True:
            while b"\r\n\r\n" not in buf:
                data = sock.recv(65535)
                if not data:
                    return
                buf += data
            _, buf = buf.split(b"\r\n\r\n", 1)
            self.protocols.append("HTTP/1.1")
            sock.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/octet-stream\r\n"
                + f"Content-Length: {len(CONTENT)}\r\n\r\n".encode()
                + CONTENT
            )

    def serve_h2(self, sock: socket.socket):
        conn = h2.connection.H2Connection(
            config=h2.config.H2Configuration(client_side=False)
        )
        conn.initiate_connection()
        sock.sendall(conn.data_to_send())
        while True:
            data = sock.recv(65535)
            if not data:
                return
            for event in conn.receive_data(data):
                if isinstance(event, h2.events.RequestReceived):
                    self.protocols.append("HTTP/2")
                    conn.send_headers(
                        event.stream_id,
                        [
                            (":status", "200"),
                            ("content-type", "application/octet-stream"),
                            ("content-length", str(len(CONTENT))),
                        ],
                    )
                    for chunk in CHUNKS:
                        conn.send_data(event.stream_id, chunk)
                        conn.send_data(event.stream_id, b"")
                    conn.end_stream(event.stream_id)
                elif isinstance(event, h2.events.ConnectionTerminated):
                    return
            out = conn.data_to_send()
            if out:
                sock.sendall(out)


@contextlib.contextmanager
def empty_data_frames_server() -> Iterator[EmptyDataFramesServer]:
    server = EmptyDataFramesServer()
    server.start()
    try:
        yield server
    finally:
        server.listener.close()


@pytest.fixture(autouse=True)
def negotiate_http2(monkeypatch):
    """Speak HTTP/2 wherever production would negotiate it over TLS: the
    server is plaintext, so force prior knowledge on every transport not
    pinned to HTTP/1.1."""
    reset_transport_caches()
    for module, name in (
        (api_client_sync, "SyncHTTPTransport"),
        (api_client_async, "HTTPTransport"),
    ):
        build_transport = getattr(module, name)

        def build(build_transport=build_transport, **kwargs):
            if kwargs.get("http_version") is None:
                kwargs["http_version"] = HTTPVersion.HTTP2
            return build_transport(**kwargs)

        monkeypatch.setattr(module, name, build)
    yield
    reset_transport_caches()


ENVD_VERSION = Version("0.6.2")


@pytest.mark.parametrize("http_version", ["2", "1.1"])
def test_sync_read_downloads_over_http1(http_version):
    config = ConnectionConfig(api_key="e2b_" + "0" * 40, http_version=http_version)
    with empty_data_frames_server() as server:
        url = f"http://127.0.0.1:{server.port}"
        fs = Filesystem(
            url, ENVD_VERSION, config, api_client_sync.get_envd_api(config, url)
        )
        for _ in range(3):
            assert fs.read("/blob", format="bytes") == CONTENT
            assert fs.read("/blob", format="text") == CONTENT.decode()
            with fs.read("/blob", format="stream") as reader:
                assert b"".join(reader) == CONTENT
        assert set(server.protocols) == {"HTTP/1.1"}


@pytest.mark.parametrize("http_version", ["2", "1.1"])
async def test_async_read_downloads_over_http1(http_version):
    config = ConnectionConfig(api_key="e2b_" + "0" * 40, http_version=http_version)
    with empty_data_frames_server() as server:
        url = f"http://127.0.0.1:{server.port}"
        fs = AsyncFilesystem(
            url, ENVD_VERSION, config, api_client_async.get_envd_api(config, url)
        )
        for _ in range(3):
            assert await fs.read("/blob", format="bytes") == CONTENT
            assert await fs.read("/blob", format="text") == CONTENT.decode()
            for idle_timeout in (None, 5):
                async with await fs.read(
                    "/blob", format="stream", stream_idle_timeout=idle_timeout
                ) as reader:
                    assert b"".join([chunk async for chunk in reader]) == CONTENT
        assert set(server.protocols) == {"HTTP/1.1"}
