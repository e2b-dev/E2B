import asyncio
import socket
import threading
import time
from typing import List

import httpx
import pytest
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport

import e2b.volume.client_async as client_async
import e2b.volume.client_sync as client_sync
from e2b.exceptions import AuthenticationException
from e2b.volume.client_async import get_api_client as get_async_api_client
from e2b.volume.client_async import get_transport as get_async_transport
from e2b.volume.client_sync import get_api_client as get_sync_api_client
from e2b.volume.client_sync import get_transport as get_sync_transport
from e2b.volume.connection_config import VolumeConnectionConfig
from e2b.volume.volume_async import AsyncVolume
from e2b.volume.volume_sync import Volume


def reset_volume_transports():
    client_sync._transports.clear()
    client_async._transports.clear()


def test_sync_client_requires_volume_token(monkeypatch):
    monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

    with pytest.raises(AuthenticationException):
        get_sync_api_client(VolumeConnectionConfig())


def test_async_client_requires_volume_token(monkeypatch):
    monkeypatch.setenv("E2B_ACCESS_TOKEN", "env-access-token")

    with pytest.raises(AuthenticationException):
        get_async_api_client(VolumeConnectionConfig())


def test_sync_client_uses_config_request_timeout():
    client = get_sync_api_client(VolumeConnectionConfig(token="vol-token"))
    assert client.get_httpx_client().timeout == httpx.Timeout(60.0)

    client = get_sync_api_client(
        VolumeConnectionConfig(token="vol-token", request_timeout=10.0)
    )
    assert client.get_httpx_client().timeout == httpx.Timeout(10.0)

    client = get_sync_api_client(
        VolumeConnectionConfig(token="vol-token", request_timeout=0)
    )
    assert client.get_httpx_client().timeout == httpx.Timeout(None)


def test_async_client_uses_config_request_timeout():
    async def run():
        client = get_async_api_client(VolumeConnectionConfig(token="vol-token"))
        assert client.get_async_httpx_client().timeout == httpx.Timeout(60.0)

        client = get_async_api_client(
            VolumeConnectionConfig(token="vol-token", request_timeout=0)
        )
        assert client.get_async_httpx_client().timeout == httpx.Timeout(None)

    asyncio.run(run())


def test_sync_transport_is_cached_per_proxy():
    reset_volume_transports()
    config = VolumeConnectionConfig(token="vol-token")
    proxied = VolumeConnectionConfig(token="vol-token", proxy="http://127.0.0.1:8080")

    try:
        transport_a = get_sync_transport(config)
        transport_b = get_sync_transport(config)
        transport_c = get_sync_transport(proxied)

        assert isinstance(transport_a, PyqwestTransport)
        assert transport_a is transport_b
        assert transport_a is not transport_c
    finally:
        reset_volume_transports()


def test_sync_transport_is_shared_across_threads():
    # pyqwest transports are thread-safe, so one transport (and its pool)
    # serves all threads — the per-thread caching this replaced is gone.
    reset_volume_transports()
    config = VolumeConnectionConfig(token="vol-token")

    try:
        main_transport = get_sync_transport(config)

        result = {}

        def worker():
            result["transport"] = get_sync_transport(config)

        thread = threading.Thread(target=worker)
        thread.start()
        thread.join()

        assert result["transport"] is main_transport
    finally:
        reset_volume_transports()


def test_async_transport_is_shared_across_loops():
    # pyqwest's I/O runs on its own Rust runtime, so the transport is not
    # bound to an event loop — the per-loop caching this replaced is gone.
    reset_volume_transports()
    config = VolumeConnectionConfig(token="vol-token")
    proxied = VolumeConnectionConfig(token="vol-token", proxy="http://127.0.0.1:8080")

    async def get_transports():
        return get_async_transport(config), get_async_transport(config)

    try:
        transport_a1, transport_a2 = asyncio.run(get_transports())
        transport_b1, _ = asyncio.run(get_transports())
        proxied_transport = get_async_transport(proxied)

        assert isinstance(transport_a1, AsyncPyqwestTransport)
        assert transport_a1 is transport_a2
        assert transport_a1 is transport_b1

        # Different proxy still gets its own transport.
        assert proxied_transport is not transport_a1
    finally:
        reset_volume_transports()


CHUNK = b"x" * 1024


def _start_volume_file_server(
    chunk_delays: List[float], ttfb_delay: float = 0.0
) -> str:
    """One-shot HTTP server streaming a chunked volume-file body, sleeping
    ``ttfb_delay`` before the response head and ``chunk_delays[i]`` before
    sending chunk ``i``. Returns its base URL."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(1)
    port = sock.getsockname()[1]

    def serve():
        try:
            conn, _ = sock.accept()
            while b"\r\n\r\n" not in conn.recv(65536):
                pass
            time.sleep(ttfb_delay)
            conn.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/octet-stream\r\n"
                b"Transfer-Encoding: chunked\r\n\r\n"
            )
            for delay in chunk_delays:
                time.sleep(delay)
                conn.sendall(f"{len(CHUNK):x}\r\n".encode() + CHUNK + b"\r\n")
            conn.sendall(b"0\r\n\r\n")
            conn.close()
        except OSError:
            pass
        finally:
            sock.close()

    threading.Thread(target=serve, daemon=True).start()
    return f"http://127.0.0.1:{port}"


@pytest.fixture
def short_read_timeout(monkeypatch):
    """Rebuild the volume transports with a short idle read timeout."""
    reset_volume_transports()
    monkeypatch.setattr(client_sync, "READ_TIMEOUT", 0.3)
    monkeypatch.setattr(client_async, "READ_TIMEOUT", 0.3)
    yield 0.3
    reset_volume_transports()


def test_sync_stream_survives_transfers_longer_than_read_timeout(short_read_timeout):
    # The transport read timeout is an idle bound that resets on every chunk:
    # a healthy stream whose total duration exceeds it must complete.
    # `stream_idle_timeout` is deprecated and ignored — a value shorter than
    # every chunk gap must not abort the stream.
    api_url = _start_volume_file_server([0.15] * 4)
    volume = Volume(volume_id="v1", name="test", token="vol-token")

    stream = volume.read_file(
        "file.bin", format="stream", stream_idle_timeout=0.01, api_url=api_url
    )
    assert b"".join(stream) == CHUNK * 4


def test_sync_stream_stall_raises_read_timeout(short_read_timeout):
    # A mid-body stall longer than the idle read timeout surfaces as
    # httpx.ReadTimeout (pyqwest's builtin TimeoutError is remapped).
    api_url = _start_volume_file_server([0.0, 5.0])
    volume = Volume(volume_id="v1", name="test", token="vol-token")

    stream = volume.read_file("file.bin", format="stream", api_url=api_url)
    received = [next(iter(stream))]
    with pytest.raises(httpx.ReadTimeout):
        for chunk in stream:
            received.append(chunk)
    assert received == [CHUNK]


def test_async_stream_survives_transfers_longer_than_read_timeout(short_read_timeout):
    api_url = _start_volume_file_server([0.15] * 4)
    volume = AsyncVolume(volume_id="v1", name="test", token="vol-token")

    async def run():
        stream = await volume.read_file(
            "file.bin", format="stream", stream_idle_timeout=0.01, api_url=api_url
        )
        return b"".join([chunk async for chunk in stream])

    assert asyncio.run(run()) == CHUNK * 4


def test_async_stream_stall_raises_read_timeout(short_read_timeout):
    api_url = _start_volume_file_server([0.0, 5.0])
    volume = AsyncVolume(volume_id="v1", name="test", token="vol-token")

    async def run():
        stream = await volume.read_file("file.bin", format="stream", api_url=api_url)
        received = [await stream.__anext__()]
        with pytest.raises(httpx.ReadTimeout):
            async for chunk in stream:
                received.append(chunk)
        return received

    assert asyncio.run(run()) == [CHUNK]


def test_stream_transport_is_separate_from_regular_transport():
    # reqwest's read timer keeps running while a request body is sent and
    # while waiting for the response head, so the idle read timeout lives on
    # a dedicated streaming transport — putting it on the shared one would
    # cut off uploads and slow unary responses longer than the idle bound.
    reset_volume_transports()
    config = VolumeConnectionConfig(token="vol-token")

    try:
        regular = get_sync_transport(config)
        streaming = get_sync_transport(config, for_streaming=True)
        assert regular is not streaming
        assert get_sync_transport(config) is regular
        assert get_sync_transport(config, for_streaming=True) is streaming

        async_regular = get_async_transport(config)
        async_streaming = get_async_transport(config, for_streaming=True)
        assert async_regular is not async_streaming
    finally:
        reset_volume_transports()


def test_sync_non_stream_read_survives_response_slower_than_idle_timeout(
    short_read_timeout,
):
    # Non-streamed requests go through the regular transport, which has no
    # idle read timeout: a server that takes longer than the streaming idle
    # bound to start responding must not be cut off.
    api_url = _start_volume_file_server([0.0], ttfb_delay=short_read_timeout * 3)
    volume = Volume(volume_id="v1", name="test", token="vol-token")

    assert volume.read_file("file.bin", format="bytes", api_url=api_url) == CHUNK


def test_sync_stream_response_head_is_bounded_by_idle_timeout(short_read_timeout):
    # For streamed reads the idle read timeout also bounds waiting for the
    # response head (like the JS SDK's handshake timeout on stream start).
    api_url = _start_volume_file_server([0.0], ttfb_delay=5.0)
    volume = Volume(volume_id="v1", name="test", token="vol-token")

    stream = volume.read_file("file.bin", format="stream", api_url=api_url)
    with pytest.raises(httpx.ReadTimeout):
        next(iter(stream))
