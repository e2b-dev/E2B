"""Long-lived envd streams must not all contend for one HTTP/2 connection."""

import asyncio
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import pytest
from envd_frame_server import stream_capacity_server
from pyqwest import HTTPVersion

import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
from e2b.connection_config import ConnectionConfig
from e2b.envd.client_async import (
    as_stream as as_async_stream,
    create_rpc_client as create_async_rpc_client,
    first_event,
)
from e2b.envd.client_sync import (
    as_stream as as_sync_stream,
    create_rpc_client as create_sync_rpc_client,
)
from e2b.envd.process.process_connect import ProcessClient, ProcessClientSync
from e2b.envd.process.process_pb import ConnectRequest
from transport_caches import reset_transport_caches

# Production `sandbox.e2b.app` advertises 100 concurrent streams per
# connection; pyqwest dials another once every connection carries that many.
STREAMS_PER_CONNECTION = 100
WAVE = 80


def sandbox_config(sandbox_id: str) -> ConnectionConfig:
    return ConnectionConfig(
        api_key="e2b_" + "0" * 40,
        extra_sandbox_headers={
            "E2b-Sandbox-Id": sandbox_id,
            "E2b-Sandbox-Port": "49983",
        },
    )


def force_http2(monkeypatch, module, name):
    # Production negotiates HTTP/2 over TLS. The frame server is plaintext, so
    # force prior knowledge while retaining the production factory/cache.
    build_transport = getattr(module, name)

    def build_http2_transport(**kwargs):
        kwargs["http_version"] = HTTPVersion.HTTP2
        return build_transport(**kwargs)

    monkeypatch.setattr(module, name, build_http2_transport)


def active_per_connection(server) -> list:
    return sorted(Counter(conn for conn, _ in server.active_streams).values())


def connections_used(server) -> int:
    # Connections that carried a stream: hyper may race an extra dial under
    # concurrent requests and drop it unused.
    return len({conn for conn, _ in server.streams})


def wait_for_active_streams(server, count: int, timeout: float = 5):
    deadline = time.monotonic() + timeout
    while len(server.active_streams) < count and time.monotonic() < deadline:
        time.sleep(0.01)
    assert len(server.active_streams) == count


async def async_wait_for_active_streams(server, count: int, timeout: float = 5):
    deadline = time.monotonic() + timeout
    while len(server.active_streams) < count and time.monotonic() < deadline:
        await asyncio.sleep(0.01)
    assert len(server.active_streams) == count


def sync_stream(server, sandbox_id: str):
    client = create_sync_rpc_client(
        ProcessClientSync,
        f"http://127.0.0.1:{server.port}",
        sandbox_config(sandbox_id),
    )
    return as_sync_stream(client.connect(ConnectRequest()))


def async_stream(server, sandbox_id: str):
    client = create_async_rpc_client(
        ProcessClient,
        f"http://127.0.0.1:{server.port}",
        sandbox_config(sandbox_id),
    )
    return as_async_stream(client.connect(ConnectRequest()))


def test_sync_envd_dials_connections_as_streams_fill_them(monkeypatch):
    """Three waves of 80 sync streams: the first fits one connection, the
    second spills onto a second, the third onto a third — and closed streams
    hand their slots back so a fourth wave dials nothing new."""
    reset_transport_caches()
    force_http2(monkeypatch, api_client_sync, "SyncHTTPTransport")

    streams = []

    def open_wave(server, wave):
        wave_streams = [sync_stream(server, f"sbx-{wave}-{i}") for i in range(WAVE)]
        streams.extend(wave_streams)
        with ThreadPoolExecutor(max_workers=len(wave_streams)) as executor:
            futures = [executor.submit(next, stream) for stream in wave_streams]
            assert len([future.result(timeout=5) for future in futures]) == WAVE
        return wave_streams

    try:
        with stream_capacity_server(
            max_concurrent_streams=STREAMS_PER_CONNECTION
        ) as server:
            first = open_wave(server, 0)
            assert connections_used(server) == 1
            assert active_per_connection(server) == [80]

            open_wave(server, 1)
            assert connections_used(server) == 2
            assert active_per_connection(server) == [60, 100]

            open_wave(server, 2)
            assert connections_used(server) == 3
            assert len(server.active_streams) == 240
            assert max(active_per_connection(server)) <= STREAMS_PER_CONNECTION

            # Closing a stream resets it and frees its slot on the connection
            # that carried it, so the next wave reuses that headroom instead
            # of dialing.
            for stream in first:
                stream.close()

            open_wave(server, 3)
            assert connections_used(server) == 3
            assert len(server.active_streams) == 240
            assert max(active_per_connection(server)) <= STREAMS_PER_CONNECTION
            server.assert_no_errors()
    finally:
        for stream in streams:
            stream.close()
        reset_transport_caches()


def test_sync_envd_waits_for_a_stream_at_the_connection_cap(monkeypatch):
    monkeypatch.setattr(api_client_sync, "max_connections", 2)
    reset_transport_caches()
    force_http2(monkeypatch, api_client_sync, "SyncHTTPTransport")

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=10) as server:
            streams = [sync_stream(server, f"sbx-{i}") for i in range(21)]
            with ThreadPoolExecutor(max_workers=len(streams)) as executor:
                futures = [executor.submit(next, stream) for stream in streams]
                wait_for_active_streams(server, 20)
                time.sleep(0.5)
                pending = [future for future in futures if not future.done()]
                assert len(pending) == 1
                assert len(server.active_streams) == 20
                assert connections_used(server) == 2
                assert active_per_connection(server) == [10, 10]

                # The queued request takes the first stream to free up.
                opened = next(i for i, f in enumerate(futures) if f.done())
                streams[opened].close()
                for future in pending:
                    future.result(timeout=2)
            assert connections_used(server) == 2
            assert active_per_connection(server) == [10, 10]
            server.assert_no_errors()
    finally:
        for stream in streams:
            stream.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_dials_connections_as_streams_fill_them(monkeypatch):
    reset_transport_caches()
    force_http2(monkeypatch, api_client_async, "HTTPTransport")

    streams = []

    async def open_wave(server, wave):
        wave_streams = [async_stream(server, f"sbx-{wave}-{i}") for i in range(WAVE)]
        streams.extend(wave_streams)
        events = await asyncio.gather(
            *(first_event(stream, 5) for stream in wave_streams),
            return_exceptions=True,
        )
        assert not [event for event in events if isinstance(event, BaseException)]
        return wave_streams

    try:
        with stream_capacity_server(
            max_concurrent_streams=STREAMS_PER_CONNECTION
        ) as server:
            first = await open_wave(server, 0)
            assert connections_used(server) == 1
            assert active_per_connection(server) == [80]

            await open_wave(server, 1)
            assert connections_used(server) == 2
            assert active_per_connection(server) == [60, 100]

            await open_wave(server, 2)
            assert connections_used(server) == 3
            assert len(server.active_streams) == 240
            assert max(active_per_connection(server)) <= STREAMS_PER_CONNECTION

            await asyncio.gather(*(stream.aclose() for stream in first))

            await open_wave(server, 3)
            assert connections_used(server) == 3
            assert len(server.active_streams) == 240
            assert max(active_per_connection(server)) <= STREAMS_PER_CONNECTION
            server.assert_no_errors()
    finally:
        await asyncio.gather(
            *(stream.aclose() for stream in streams), return_exceptions=True
        )
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_waits_for_a_stream_at_the_connection_cap(monkeypatch):
    monkeypatch.setattr(api_client_async, "max_connections", 2)
    reset_transport_caches()
    force_http2(monkeypatch, api_client_async, "HTTPTransport")

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=10) as server:
            streams = [async_stream(server, f"sbx-{i}") for i in range(21)]
            tasks = [
                asyncio.ensure_future(first_event(stream, None)) for stream in streams
            ]
            await async_wait_for_active_streams(server, 20)
            await asyncio.sleep(0.5)
            pending = [task for task in tasks if not task.done()]
            assert len(pending) == 1
            assert len(server.active_streams) == 20
            assert connections_used(server) == 2
            assert active_per_connection(server) == [10, 10]

            # The queued request takes the first stream to free up.
            opened = next(i for i, task in enumerate(tasks) if task.done())
            await streams[opened].aclose()
            await asyncio.wait_for(asyncio.gather(*pending), 2)
            assert connections_used(server) == 2
            assert active_per_connection(server) == [10, 10]
            server.assert_no_errors()
    finally:
        await asyncio.gather(
            *(stream.aclose() for stream in streams), return_exceptions=True
        )
        reset_transport_caches()
