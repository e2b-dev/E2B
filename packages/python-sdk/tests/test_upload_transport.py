"""File uploads bypass the connect retries so their body isn't copied.

The retry middleware makes a request body replayable by copying it in full as
it is sent — reqwest reads ahead into the body while connecting, so a connect
error leaves the iterator already started and unrewindable, and the copy is the
only way back. For a `volume.write_file`, an envd `files.write` or a template
context upload that means the whole file in RAM while it is also being streamed
to the wire (SDK-332): a 64 MiB upload peaked at 70 MB.

So uploads take an httpx adapter over the same pool with the retry layer left
out. They keep the pooled connections and give up the connect retry, which
fires before any of the body was written and so surfaces to the caller intact.
"""

import os
import tempfile
import threading
import tracemalloc
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from packaging.version import Version
from pyqwest import HTTPTransport, SyncHTTPTransport
from transport_caches import reset_transport_caches

from e2b.api.client_async import ConnectionRetryTransport
from e2b.api.client_async import get_envd_api as get_async_envd_api
from e2b.api.client_async import get_pool as get_async_pool
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_async import get_upload_transport as get_async_upload_transport
from e2b.api.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
)
from e2b.api.client_sync import get_envd_api, get_pool, get_transport
from e2b.api.client_sync import get_upload_transport
from e2b.connection_config import ConnectionConfig
from e2b.io_utils import aiter_io_chunks
from e2b.sandbox_async.filesystem.filesystem import Filesystem as AsyncFilesystem
from e2b.sandbox_sync.filesystem.filesystem import Filesystem

MIB = 1 << 20
# Enough that a copy of the body would dwarf everything else the transfer
# allocates, while staying quick over the loopback interface.
UPLOAD_SIZE = 32 * MIB
# The streaming path allocates a chunk at a time (~1 MiB peak measured); the
# retrying transport's copy put this transfer's peak at 39 MB.
MAX_UPLOAD_PEAK = 8 * MIB

ENVD_URL = "https://49999-sandbox.e2b.app"


def test_sync_upload_transport_is_the_same_pool_without_retries(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        upload = get_upload_transport(None)
        retrying = get_transport(config)

        # Same connection pool underneath, so an upload still travels the
        # pooled connections; only the retry layer is missing.
        assert isinstance(upload._transport, SyncHTTPTransport)
        assert upload._transport is get_pool(None)
        assert isinstance(retrying._transport, SyncConnectionRetryTransport)
        assert retrying._transport._transport is upload._transport

        # Cached like every other transport, per proxy and idle read bound.
        assert get_upload_transport(None) is upload
        assert get_transport(config, for_upload=True) is upload
        assert get_upload_transport(None, 60.0) is not upload
    finally:
        reset_transport_caches()


def test_async_upload_transport_is_the_same_pool_without_retries(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        upload = get_async_upload_transport(None)
        retrying = get_async_transport(config)

        assert isinstance(upload._transport, HTTPTransport)
        assert upload._transport is get_async_pool(None)
        assert isinstance(retrying._transport, ConnectionRetryTransport)
        assert retrying._transport._transport is upload._transport

        assert get_async_upload_transport(None) is upload
        assert get_async_transport(config, for_upload=True) is upload
    finally:
        reset_transport_caches()


def test_sync_envd_upload_client_uses_the_upload_transport(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, access_token="tok")

    client = get_envd_api(config, ENVD_URL, for_upload=True)
    try:
        assert client._transport is get_transport(config, for_upload=True)
    finally:
        client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_upload_client_uses_the_upload_transport(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, access_token="tok")

    client = get_async_envd_api(config, ENVD_URL, for_upload=True)
    try:
        assert client._transport is get_async_transport(config, for_upload=True)
    finally:
        await client.aclose()
        reset_transport_caches()


def test_sync_filesystem_writes_go_to_the_upload_client(test_api_key):
    # `files.write` posts on `_envd_api_upload`; the retrying client stays for
    # the unary calls and health probes, the streaming one for downloads.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, access_token="tok")
    envd_api = get_envd_api(config, ENVD_URL)

    filesystem = Filesystem(ENVD_URL, Version("0.7.0"), config, envd_api)
    try:
        assert filesystem._envd_api._transport is get_transport(config)
        assert filesystem._envd_api_upload._transport is get_transport(
            config, for_upload=True
        )
        assert filesystem._envd_api_streaming._transport is get_transport(
            config, for_streaming=True
        )
    finally:
        filesystem._envd_api_upload.close()
        filesystem._envd_api_streaming.close()
        envd_api.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_filesystem_writes_go_to_the_upload_client(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, access_token="tok")
    envd_api = get_async_envd_api(config, ENVD_URL)

    filesystem = AsyncFilesystem(ENVD_URL, Version("0.7.0"), config, envd_api)
    try:
        assert filesystem._envd_api._transport is get_async_transport(config)
        assert filesystem._envd_api_upload._transport is get_async_transport(
            config, for_upload=True
        )
        assert filesystem._envd_api_streaming._transport is get_async_transport(
            config, for_streaming=True
        )
    finally:
        await filesystem._envd_api_upload.aclose()
        await filesystem._envd_api_streaming.aclose()
        await envd_api.aclose()
        reset_transport_caches()


def _write_response(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200, json=[{"name": "a.txt", "type": "file", "path": "/home/user/a.txt"}]
    )


def _routing_filesystem(config: ConnectionConfig, kind: type):
    """A ``Filesystem`` whose two write clients record which one was used."""
    filesystem = kind(ENVD_URL, Version("0.7.0"), config, None)
    used = []

    def record(name):
        def handler(request: httpx.Request) -> httpx.Response:
            used.append(name)
            return _write_response(request)

        return handler

    client = httpx.AsyncClient if kind is AsyncFilesystem else httpx.Client
    filesystem._envd_api = client(
        base_url=ENVD_URL, transport=httpx.MockTransport(record("retrying"))
    )
    filesystem._envd_api_upload = client(
        base_url=ENVD_URL, transport=httpx.MockTransport(record("upload"))
    )
    return filesystem, used


@pytest.mark.parametrize("use_octet_stream", [True, False])
def test_sync_only_streamed_writes_skip_the_retries(
    test_api_key, tmp_path, use_octet_stream
):
    # An in-memory body reaches the transport as `bytes` (or a tiny multipart
    # stream), so the retry layer replays it for free and keeps its retries; a
    # file-like one is the body that would be copied whole.
    config = ConnectionConfig(api_key=test_api_key, access_token="tok")
    filesystem, used = _routing_filesystem(config, Filesystem)
    path = tmp_path / "a.txt"
    path.write_text("streamed")

    try:
        filesystem.write("/home/user/a.txt", "text", use_octet_stream=use_octet_stream)
        with open(path, "rb") as file:
            filesystem.write(
                "/home/user/a.txt", file, use_octet_stream=use_octet_stream
            )

        assert used == ["retrying", "upload"]
    finally:
        filesystem._envd_api.close()
        filesystem._envd_api_upload.close()
        filesystem._envd_api_streaming.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("use_octet_stream", [True, False])
async def test_async_only_streamed_writes_skip_the_retries(
    test_api_key, tmp_path, use_octet_stream
):
    config = ConnectionConfig(api_key=test_api_key, access_token="tok")
    filesystem, used = _routing_filesystem(config, AsyncFilesystem)
    path = tmp_path / "a.txt"
    path.write_text("streamed")

    try:
        await filesystem.write(
            "/home/user/a.txt", "text", use_octet_stream=use_octet_stream
        )
        with open(path, "rb") as file:
            await filesystem.write(
                "/home/user/a.txt", file, use_octet_stream=use_octet_stream
            )

        assert used == ["retrying", "upload"]
    finally:
        await filesystem._envd_api.aclose()
        await filesystem._envd_api_upload.aclose()
        await filesystem._envd_api_streaming.aclose()


class _UploadHandler(BaseHTTPRequestHandler):
    """Reads a request body in small blocks — never holding it whole — and
    records how much arrived."""

    protocol_version = "HTTP/1.1"
    received = None

    def do_PUT(self):
        length = int(self.headers.get("Content-Length", 0))
        read = 0
        while read < length:
            block = self.rfile.read(min(1 << 16, length - read))
            if not block:
                break
            read += len(block)
        _UploadHandler.received = (read, self.headers.get("Transfer-Encoding"))
        self.send_response(200)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, *args):
        pass


@pytest.fixture
def upload_server():
    _UploadHandler.received = None
    server = ThreadingHTTPServer(("127.0.0.1", 0), _UploadHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join()


@pytest.fixture
def upload_file_path():
    path = os.path.join(tempfile.mkdtemp(), "context.tar.gz")
    with open(path, "wb") as file:
        for _ in range(UPLOAD_SIZE // MIB):
            file.write(b"x" * MIB)
    try:
        yield path
    finally:
        os.remove(path)


def test_sync_upload_is_streamed_and_not_mirrored(upload_server, upload_file_path):
    # The shape of a volume or template context upload: a file streamed with
    # Content-Length framing (S3 presigned URLs reject chunked encoding), and
    # nothing on the client holding on to what has already gone out.
    reset_transport_caches()
    client = httpx.Client(transport=get_upload_transport(None), timeout=None)

    try:
        with open(upload_file_path, "rb") as file:
            tracemalloc.start()
            response = client.put(f"{upload_server}/upload", content=file)
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

        assert response.status_code == 200
        assert _UploadHandler.received == (UPLOAD_SIZE, None)
        assert peak < MAX_UPLOAD_PEAK
    finally:
        client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_upload_is_streamed_and_not_mirrored(
    upload_server, upload_file_path
):
    reset_transport_caches()
    client = httpx.AsyncClient(transport=get_async_upload_transport(None), timeout=None)

    try:
        with open(upload_file_path, "rb") as file:
            tracemalloc.start()
            response = await client.put(
                f"{upload_server}/upload",
                content=aiter_io_chunks(file),
                headers={"Content-Length": str(UPLOAD_SIZE)},
            )
            _, peak = tracemalloc.get_traced_memory()
            tracemalloc.stop()

        assert response.status_code == 200
        assert _UploadHandler.received == (UPLOAD_SIZE, None)
        assert peak < MAX_UPLOAD_PEAK
    finally:
        await client.aclose()
        reset_transport_caches()
