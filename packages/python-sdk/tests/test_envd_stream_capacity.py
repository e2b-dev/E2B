"""Long-lived envd streams must not all contend for one HTTP/2 connection."""

import asyncio
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import pytest
from envd_frame_server import stream_capacity_server
from pyqwest import HTTPVersion

import e2b.api as api
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
# connection; the SDK dials another once a pool carries that many.
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


def active_streams(pool) -> list:
    # Every stream in these tests goes to the frame server's one origin.
    return [
        sum(connection.active.values())
        for connection in pool._transport.balancer.connections
    ]


def wave_counts(server, since: int) -> Counter:
    return Counter(connection_id for connection_id, _ in server.streams[since:])


def connections_used(server) -> int:
    # Connections that carried a stream: hyper may race an extra dial for a
    # fresh pool under concurrent requests and drop it unused.
    return len(wave_counts(server, 0))


def test_sync_envd_dials_connections_as_streams_fill_them(monkeypatch):
    """Three waves of 80 sync streams: the first fits one connection, the
    second spills onto a second, the third onto a third — and closed streams
    hand their slots back so a fourth wave dials nothing new."""
    monkeypatch.setattr(api, "streams_per_connection", STREAMS_PER_CONNECTION)
    monkeypatch.setattr(api, "max_connections", 200)
    reset_transport_caches()
    force_http2(monkeypatch, api_client_sync, "SyncHTTPTransport")

    streams = []

    def open_wave(server, wave):
        wave_streams = []
        for index in range(WAVE):
            client = create_sync_rpc_client(
                ProcessClientSync,
                f"http://127.0.0.1:{server.port}",
                sandbox_config(f"sbx-wave-{wave}-{index}"),
            )
            wave_streams.append(as_sync_stream(client.connect(ConnectRequest())))
        streams.extend(wave_streams)
        with ThreadPoolExecutor(max_workers=len(wave_streams)) as executor:
            futures = [executor.submit(next, stream) for stream in wave_streams]
            assert len([future.result(timeout=2) for future in futures]) == WAVE
        return wave_streams

    try:
        with stream_capacity_server(
            max_concurrent_streams=STREAMS_PER_CONNECTION
        ) as server:
            pool = api_client_sync.get_pyqwest_transport(None)

            first = open_wave(server, 0)
            assert connections_used(server) == 1
            assert active_streams(pool) == [80]

            open_wave(server, 1)
            assert connections_used(server) == 2
            assert active_streams(pool) == [100, 60]
            assert sorted(wave_counts(server, 80).values()) == [20, 60]

            open_wave(server, 2)
            assert connections_used(server) == 3
            assert active_streams(pool) == [100, 100, 40]
            assert len(server.active_streams) == 240

            # Closing a stream resets it and frees its slot on the connection
            # that carried it, so the next wave reuses that headroom instead
            # of dialing.
            for stream in first:
                stream.close()
            assert active_streams(pool) == [20, 100, 40]

            open_wave(server, 3)
            assert connections_used(server) == 3
            assert active_streams(pool) == [70, 100, 70]
            assert len(server.streams) == 320
            server.assert_no_errors()
    finally:
        for stream in streams:
            stream.close()
        reset_transport_caches()


def test_sync_envd_stops_dialing_at_the_connection_cap(monkeypatch):
    monkeypatch.setattr(api, "streams_per_connection", 10)
    monkeypatch.setattr(api, "max_connections", 2)
    reset_transport_caches()
    force_http2(monkeypatch, api_client_sync, "SyncHTTPTransport")

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=100) as server:
            for index in range(30):
                client = create_sync_rpc_client(
                    ProcessClientSync,
                    f"http://127.0.0.1:{server.port}",
                    sandbox_config(f"sbx-{index}"),
                )
                streams.append(as_sync_stream(client.connect(ConnectRequest())))
            with ThreadPoolExecutor(max_workers=len(streams)) as executor:
                futures = [executor.submit(next, stream) for stream in streams]
                assert len([future.result(timeout=2) for future in futures]) == 30

            pool = api_client_sync.get_pyqwest_transport(None)
            assert connections_used(server) == 2
            assert active_streams(pool) == [15, 15]
            assert sorted(wave_counts(server, 0).values()) == [15, 15]
            server.assert_no_errors()
    finally:
        for stream in streams:
            stream.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_dials_connections_as_streams_fill_them(monkeypatch):
    monkeypatch.setattr(api, "streams_per_connection", STREAMS_PER_CONNECTION)
    monkeypatch.setattr(api, "max_connections", 200)
    reset_transport_caches()
    force_http2(monkeypatch, api_client_async, "HTTPTransport")

    streams = []

    async def open_wave(server, wave):
        wave_streams = []
        for index in range(WAVE):
            client = create_async_rpc_client(
                ProcessClient,
                f"http://127.0.0.1:{server.port}",
                sandbox_config(f"sbx-wave-{wave}-{index}"),
            )
            wave_streams.append(as_async_stream(client.connect(ConnectRequest())))
        streams.extend(wave_streams)
        events = await asyncio.gather(
            *(first_event(stream, 0.5) for stream in wave_streams),
            return_exceptions=True,
        )
        assert not [event for event in events if isinstance(event, BaseException)]
        return wave_streams

    try:
        with stream_capacity_server(
            max_concurrent_streams=STREAMS_PER_CONNECTION
        ) as server:
            pool = api_client_async.get_pyqwest_transport(None)

            first = await open_wave(server, 0)
            assert connections_used(server) == 1
            assert active_streams(pool) == [80]

            await open_wave(server, 1)
            assert connections_used(server) == 2
            assert active_streams(pool) == [100, 60]
            assert sorted(wave_counts(server, 80).values()) == [20, 60]

            await open_wave(server, 2)
            assert connections_used(server) == 3
            assert active_streams(pool) == [100, 100, 40]
            assert len(server.active_streams) == 240

            await asyncio.gather(*(stream.aclose() for stream in first))
            assert active_streams(pool) == [20, 100, 40]

            await open_wave(server, 3)
            assert connections_used(server) == 3
            assert active_streams(pool) == [70, 100, 70]
            assert len(server.streams) == 320
            server.assert_no_errors()
    finally:
        await asyncio.gather(
            *(stream.aclose() for stream in streams), return_exceptions=True
        )
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_stops_dialing_at_the_connection_cap(monkeypatch):
    monkeypatch.setattr(api, "streams_per_connection", 10)
    monkeypatch.setattr(api, "max_connections", 2)
    reset_transport_caches()
    force_http2(monkeypatch, api_client_async, "HTTPTransport")

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=100) as server:
            for index in range(30):
                client = create_async_rpc_client(
                    ProcessClient,
                    f"http://127.0.0.1:{server.port}",
                    sandbox_config(f"sbx-{index}"),
                )
                streams.append(as_async_stream(client.connect(ConnectRequest())))
            events = await asyncio.gather(
                *(first_event(stream, 0.5) for stream in streams),
                return_exceptions=True,
            )
            assert not [event for event in events if isinstance(event, BaseException)]

            pool = api_client_async.get_pyqwest_transport(None)
            assert connections_used(server) == 2
            assert active_streams(pool) == [15, 15]
            assert sorted(wave_counts(server, 0).values()) == [15, 15]
            server.assert_no_errors()
    finally:
        await asyncio.gather(
            *(stream.aclose() for stream in streams), return_exceptions=True
        )
        reset_transport_caches()
