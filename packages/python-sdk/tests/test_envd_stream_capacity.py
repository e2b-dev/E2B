"""Long-lived envd streams must not all contend for one HTTP/2 connection."""

import asyncio
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

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


# The customer scenario this guards: 192 long-running agent commands, whose
# streams must all be admitted although the sandbox host caps each HTTP/2
# connection at 100 concurrent streams — and must be, whether they come from
# 192 sandboxes or a single busy one.
STREAMS = 192
POOL_STREAMS = 90


def connection_loads(server) -> Counter:
    return Counter(connection_id for connection_id, _ in server.active_streams)


def wait_for(condition: Callable[[], bool], timeout: float = 2.0) -> None:
    deadline = time.monotonic() + timeout
    while not condition():
        assert time.monotonic() < deadline, "condition not met in time"
        time.sleep(0.01)


def sandbox_ids(spread: bool):
    return [f"sbx-{index if spread else 0}" for index in range(STREAMS)]


@pytest.mark.parametrize("spread", [True, False], ids=["many-sandboxes", "one-sandbox"])
def test_sync_envd_grows_pools_with_in_flight_streams(monkeypatch, spread):
    monkeypatch.setattr(api, "envd_pool_streams", POOL_STREAMS)
    reset_transport_caches()
    build_transport = api_client_sync.SyncHTTPTransport

    def build_http2_transport(**kwargs):
        # Production negotiates HTTP/2 over TLS. The frame server is plaintext,
        # so force prior knowledge while retaining the production factory/cache.
        kwargs["http_version"] = HTTPVersion.HTTP2
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_sync, "SyncHTTPTransport", build_http2_transport)

    def open_streams(ids):
        opened = []
        for sandbox_id in ids:
            client = create_sync_rpc_client(
                ProcessClientSync,
                f"http://127.0.0.1:{server.port}",
                sandbox_config(sandbox_id),
            )
            opened.append(as_sync_stream(client.connect(ConnectRequest())))
        with ThreadPoolExecutor(max_workers=len(opened)) as executor:
            futures = [executor.submit(next, stream) for stream in opened]
            for future in futures:
                future.result(timeout=2)
        return opened

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=100) as server:
            balancer = api_client_sync.get_envd_pyqwest_transport(None).balancer

            streams += open_streams(sandbox_ids(spread))

            # Every stream is open, over just enough connections: pools fill to
            # their bound before the next one is opened.
            assert len(server.active_streams) == STREAMS
            assert balancer.active_streams == (90, 90, 12)
            assert sorted(connection_loads(server).values()) == [12, 90, 90]

            # Ending streams frees their slots — the first pool's entirely —
            # which the next burst reuses instead of opening connections.
            for stream in streams[:100]:
                stream.close()
            wait_for(lambda: len(server.active_streams) == STREAMS - 100)
            assert balancer.active_streams == (0, 80, 12)

            streams += open_streams(sandbox_ids(spread)[:50])

            assert balancer.active_streams == (31, 80, 31)
            assert len(server.connections) == 3
            server.assert_no_errors()
    finally:
        for stream in streams:
            stream.close()
        reset_transport_caches()


@pytest.mark.asyncio
@pytest.mark.parametrize("spread", [True, False], ids=["many-sandboxes", "one-sandbox"])
async def test_async_envd_grows_pools_with_in_flight_streams(monkeypatch, spread):
    monkeypatch.setattr(api, "envd_pool_streams", POOL_STREAMS)
    reset_transport_caches()
    build_transport = api_client_async.HTTPTransport

    def build_http2_transport(**kwargs):
        kwargs["http_version"] = HTTPVersion.HTTP2
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_async, "HTTPTransport", build_http2_transport)

    async def open_streams(ids):
        opened = []
        for sandbox_id in ids:
            client = create_async_rpc_client(
                ProcessClient,
                f"http://127.0.0.1:{server.port}",
                sandbox_config(sandbox_id),
            )
            opened.append(as_async_stream(client.connect(ConnectRequest())))
        events = await asyncio.gather(
            *(first_event(stream, 2) for stream in opened), return_exceptions=True
        )
        assert not [event for event in events if isinstance(event, BaseException)]
        return opened

    streams = []
    try:
        with stream_capacity_server(max_concurrent_streams=100) as server:
            balancer = api_client_async.get_envd_pyqwest_transport(None).balancer

            streams += await open_streams(sandbox_ids(spread))

            assert len(server.active_streams) == STREAMS
            assert balancer.active_streams == (90, 90, 12)
            assert sorted(connection_loads(server).values()) == [12, 90, 90]

            await asyncio.gather(*(stream.aclose() for stream in streams[:100]))
            await asyncio.to_thread(
                wait_for, lambda: len(server.active_streams) == STREAMS - 100
            )
            assert balancer.active_streams == (0, 80, 12)

            streams += await open_streams(sandbox_ids(spread)[:50])

            assert balancer.active_streams == (31, 80, 31)
            assert len(server.connections) == 3
            server.assert_no_errors()
    finally:
        await asyncio.gather(
            *(stream.aclose() for stream in streams), return_exceptions=True
        )
        reset_transport_caches()
