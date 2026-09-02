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


def sandbox_config(sandbox_id: str) -> ConnectionConfig:
    return ConnectionConfig(
        api_key="e2b_" + "0" * 40,
        extra_sandbox_headers={
            "E2b-Sandbox-Id": sandbox_id,
            "E2b-Sandbox-Port": "49983",
        },
    )


def test_sync_envd_spreads_repeated_waves_across_reused_connections(monkeypatch):
    """Fresh sync sandboxes keep filling the same four pools evenly."""
    monkeypatch.setattr(api, "envd_pool_shards", 4)
    reset_transport_caches()
    build_transport = api_client_sync.SyncHTTPTransport

    def build_http2_transport(**kwargs):
        # Production negotiates HTTP/2 over TLS. The frame server is plaintext,
        # so force prior knowledge while retaining the production factory/cache.
        kwargs["http_version"] = HTTPVersion.HTTP2
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_sync, "SyncHTTPTransport", build_http2_transport)

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=100) as server:
            connection_ids = None
            for wave in range(3):
                wave_streams = []
                for index in range(80):
                    client = create_sync_rpc_client(
                        ProcessClientSync,
                        f"http://127.0.0.1:{server.port}",
                        sandbox_config(f"sbx-wave-{wave}-{index}"),
                    )
                    wave_streams.append(
                        as_sync_stream(client.connect(ConnectRequest(), timeout_ms=500))
                    )
                streams.extend(wave_streams)

                stream_count = len(server.streams)
                with ThreadPoolExecutor(max_workers=len(wave_streams)) as executor:
                    futures = [executor.submit(next, stream) for stream in wave_streams]
                    events = [future.result(timeout=2) for future in futures]

                assert len(events) == 80
                wave_counts = Counter(
                    connection_id for connection_id, _ in server.streams[stream_count:]
                )
                assert len(wave_counts) == 4
                if connection_ids is None:
                    connection_ids = set(wave_counts)
                assert set(wave_counts) == connection_ids
                assert max(wave_counts.values()) - min(wave_counts.values()) <= 2

            assert len(server.connections) == 4
            assert len(server.streams) == 240
            server.assert_no_errors()
    finally:
        for stream in streams:
            stream.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_spreads_repeated_waves_across_reused_connections(
    monkeypatch,
):
    """Fresh async sandboxes keep filling the same four pools evenly."""
    monkeypatch.setattr(api, "envd_pool_shards", 4)
    reset_transport_caches()
    build_transport = api_client_async.HTTPTransport

    def build_http2_transport(**kwargs):
        # Production negotiates HTTP/2 over TLS. The frame server is plaintext,
        # so force prior knowledge while retaining the production factory/cache.
        kwargs["http_version"] = HTTPVersion.HTTP2
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_async, "HTTPTransport", build_http2_transport)

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=100) as server:
            connection_ids = None
            for wave in range(3):
                wave_streams = []
                for index in range(80):
                    client = create_async_rpc_client(
                        ProcessClient,
                        f"http://127.0.0.1:{server.port}",
                        sandbox_config(f"sbx-wave-{wave}-{index}"),
                    )
                    wave_streams.append(
                        as_async_stream(client.connect(ConnectRequest()))
                    )
                streams.extend(wave_streams)

                stream_count = len(server.streams)
                events = await asyncio.gather(
                    *(first_event(stream, 0.5) for stream in wave_streams),
                    return_exceptions=True,
                )

                assert not [
                    event for event in events if isinstance(event, BaseException)
                ]
                wave_counts = Counter(
                    connection_id for connection_id, _ in server.streams[stream_count:]
                )
                assert len(wave_counts) == 4
                if connection_ids is None:
                    connection_ids = set(wave_counts)
                assert set(wave_counts) == connection_ids
                assert max(wave_counts.values()) - min(wave_counts.values()) <= 2

            assert len(server.connections) == 4
            assert len(server.streams) == 240
            server.assert_no_errors()
    finally:
        await asyncio.gather(
            *(stream.aclose() for stream in streams), return_exceptions=True
        )
        reset_transport_caches()
