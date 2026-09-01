import asyncio
import base64
import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest
from pyqwest import HTTPVersion, Request, SyncRequest
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport
from transport_caches import reset_transport_caches

import e2b.api as api
import e2b.api.client_async as api_client_async
import e2b.api.client_sync as api_client_sync
from e2b.api import (
    envd_pool_shard,
    pool_idle_timeout,
    pool_max_idle_per_host,
    proxy_to_config,
)
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_envd_api as get_async_envd_api
from e2b.api.client_async import get_envd_transport as get_async_envd_transport
from e2b.api.client_async import (
    get_pyqwest_transport as get_async_pyqwest_transport,
)
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.api.client_sync import get_envd_api as get_sync_envd_api
from e2b.api.client_sync import get_envd_transport as get_sync_envd_transport
from e2b.api.client_sync import get_pyqwest_transport as get_sync_pyqwest_transport
from e2b.api.client_sync import get_transport as get_sync_transport
from e2b.connection_config import READ_TIMEOUT, ConnectionConfig


def run_in_worker_thread(fn):
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(fn).result()


def sandbox_config(test_api_key: str, sandbox_id: str) -> ConnectionConfig:
    return ConnectionConfig(
        api_key=test_api_key,
        extra_sandbox_headers={
            "E2b-Sandbox-Id": sandbox_id,
            "E2b-Sandbox-Port": "49983",
        },
    )


@pytest.mark.parametrize("pool_shards", [1, 4, 8])
def test_envd_pool_shard_respects_configured_count(
    test_api_key, monkeypatch, pool_shards
):
    monkeypatch.setattr(api, "envd_pool_shards", pool_shards)

    assigned = {
        envd_pool_shard(sandbox_config(test_api_key, f"sbx-{index}"))
        for index in range(100)
    }

    assert assigned == set(range(pool_shards))


def test_sync_api_client_proxy_uses_explicit_transport(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is get_sync_transport(config)
        assert isinstance(httpx_client._transport, PyqwestTransport)
        assert httpx_client._mounts == {}
    finally:
        httpx_client.close()
        reset_transport_caches()


def test_sync_get_transport_keyed_by_proxy(test_api_key):
    reset_transport_caches()
    proxied_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )
    direct_config = ConnectionConfig(api_key=test_api_key)
    other_proxy_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:8888",
    )

    try:
        proxied_transport = get_sync_transport(proxied_config)
        direct_transport = get_sync_transport(direct_config)
        other_proxy_transport = get_sync_transport(other_proxy_config)

        assert proxied_transport is not direct_transport
        assert proxied_transport is not other_proxy_transport
        assert direct_transport is not other_proxy_transport
        # The same proxy still reuses the cached instance.
        assert get_sync_transport(proxied_config) is proxied_transport
        assert get_sync_transport(direct_config) is direct_transport
    finally:
        reset_transport_caches()


def test_sync_transports_keyed_by_http_version(test_api_key):
    # The HTTP version is part of the cache key: without it, whichever caller
    # asked second would get a transport pinned to the other version.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    proxied_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )

    try:
        negotiated = get_sync_transport(config)
        http1 = get_sync_transport(config, http2=False)
        envd_negotiated = get_sync_envd_transport(config)
        envd_http1 = get_sync_envd_transport(config, http2=False)

        assert http1 is not negotiated
        assert envd_http1 is not envd_negotiated
        # A config without sandbox headers resolves envd to shard zero, so it
        # shares the generic transport for each HTTP version.
        assert envd_negotiated is negotiated
        assert envd_http1 is http1
        # Each version still has one pool per proxy, and repeat calls with the
        # same arguments reuse it.
        assert get_sync_transport(proxied_config, http2=False) not in (
            http1,
            negotiated,
        )
        assert get_sync_transport(config, http2=False) is http1
        assert get_sync_transport(config) is negotiated
        assert get_sync_envd_transport(config, http2=False) is envd_http1
        assert (
            get_sync_envd_transport(config, http2=False, for_streaming=True)
            is not envd_http1
        )
    finally:
        reset_transport_caches()


def test_sync_envd_transports_are_consistently_sharded_by_sandbox(
    test_api_key, monkeypatch
):
    monkeypatch.setattr(api, "envd_pool_shards", 4)
    reset_transport_caches()
    first = sandbox_config(test_api_key, "sbx-0")
    same_shard = sandbox_config(test_api_key, "sbx-2")
    different_shard = sandbox_config(test_api_key, "sbx-1")

    try:
        assert envd_pool_shard(first) == envd_pool_shard(same_shard)
        assert envd_pool_shard(first) != envd_pool_shard(different_shard)
        assert get_sync_envd_transport(first) is get_sync_envd_transport(same_shard)
        assert get_sync_envd_transport(first) is not get_sync_envd_transport(
            different_shard
        )
        # Generic API traffic remains on shard zero rather than multiplying
        # control-plane connections for every envd shard.
        assert get_sync_envd_transport(first) is not get_sync_transport(first)
    finally:
        reset_transport_caches()


def test_sync_transports_pass_http_version_to_pyqwest(test_api_key, monkeypatch):
    # `http_version=None` leaves the version to ALPN (HTTP/2 against the E2B
    # API), `HTTP1` pins HTTP/1.1. Which version was negotiated is only
    # observable over TLS — the local echo server is plaintext, where both
    # settings speak HTTP/1 — so assert what reaches the pyqwest transport.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    captured = []
    build_transport = api_client_sync.SyncHTTPTransport

    def record(**kwargs):
        captured.append(kwargs["http_version"])
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_sync, "SyncHTTPTransport", record)

    try:
        get_sync_transport(config)
        get_sync_transport(config, http2=False)
        # A third pool: same version as the call above, different idle bound.
        # (`get_envd_transport(config, http2=False)` would be a cache hit and
        # build nothing, since it shares the control plane's pool.)
        get_sync_envd_transport(config, http2=False, for_streaming=True)

        assert captured == [None, HTTPVersion.HTTP1, HTTPVersion.HTTP1]
    finally:
        reset_transport_caches()


def test_sync_transport_passes_pool_tuning_to_pyqwest(test_api_key, monkeypatch):
    # The tuning that keeps a sandbox on one reused connection has to reach the
    # pyqwest constructor: dropping any of it (`pool_max_idle_per_host=0`, no
    # system CA certs, `follow_redirects=True`) would leave every identity and
    # frame-level test green while a sandbox redialed on every request or TLS
    # broke through an intercepting proxy. The identity assertions only prove
    # one pool is reused, not how it was built.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    captured = {}
    build_transport = api_client_sync.SyncHTTPTransport

    def record(**kwargs):
        captured.update(kwargs)
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_sync, "SyncHTTPTransport", record)

    try:
        # The streaming pool is the one carrying the idle read bound, so it
        # pins `read_timeout` reaching the constructor as well.
        get_sync_transport(config, for_streaming=True)

        assert captured["tls_include_system_certs"] is True
        assert captured["proxy"] is None
        assert captured["pool_idle_timeout"] == pool_idle_timeout
        assert captured["pool_max_idle_per_host"] == pool_max_idle_per_host
        assert captured["read_timeout"] == READ_TIMEOUT
        assert captured["follow_redirects"] is False
    finally:
        reset_transport_caches()


def test_sync_api_client_applies_request_timeout(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=1.5)

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(1.5)
    finally:
        httpx_client.close()
        reset_transport_caches()


def test_sync_api_client_request_timeout_zero_disables_timeout(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=0)

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(None)
    finally:
        httpx_client.close()
        reset_transport_caches()


def test_sync_generic_transport_separates_streaming_read_timeout(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        api_transport = get_sync_transport(config)
        streaming_transport = get_sync_transport(config, for_streaming=True)

        assert isinstance(api_transport, PyqwestTransport)
        assert api_transport is get_sync_transport(config, for_streaming=False)
        assert streaming_transport is not api_transport
        assert get_sync_transport(config, for_streaming=True) is streaming_transport
    finally:
        reset_transport_caches()


def test_sync_envd_api_client_wiring(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    client = get_sync_envd_api(config, "https://sandbox.e2b.app")
    streaming = get_sync_envd_api(config, "https://sandbox.e2b.app", for_streaming=True)

    try:
        assert client.base_url == "https://sandbox.e2b.app"
        assert client._transport is get_sync_transport(config)
        assert streaming._transport is get_sync_transport(config, for_streaming=True)
        for header, value in config.sandbox_headers.items():
            assert client.headers[header] == value
    finally:
        client.close()
        streaming.close()
        reset_transport_caches()


def test_sync_api_client_is_shared_across_threads(test_api_key):
    # httpx.Client is thread-safe and the pyqwest transport underneath is
    # too, so a single client (and its pool) serves all threads — the
    # per-thread client caching this replaced is gone.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    api_client = get_sync_api_client(config)

    try:
        main_client = api_client.get_httpx_client()
        worker_client = run_in_worker_thread(api_client.get_httpx_client)

        assert api_client.get_httpx_client() is main_client
        assert worker_client is main_client
    finally:
        main_client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_proxy_uses_explicit_transport(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )

    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        assert "proxy" not in api_client._httpx_args
        assert httpx_client._transport is get_async_transport(config)
        assert isinstance(httpx_client._transport, AsyncPyqwestTransport)
        assert httpx_client._mounts == {}
    finally:
        await httpx_client.aclose()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_get_transport_keyed_by_proxy(test_api_key):
    reset_transport_caches()
    proxied_config = ConnectionConfig(
        api_key=test_api_key,
        proxy="http://127.0.0.1:9999",
    )
    direct_config = ConnectionConfig(api_key=test_api_key)

    try:
        proxied_transport = get_async_transport(proxied_config)
        direct_transport = get_async_transport(direct_config)

        assert proxied_transport is not direct_transport
        # The same proxy still reuses the cached instance.
        assert get_async_transport(proxied_config) is proxied_transport
        assert get_async_transport(direct_config) is direct_transport
    finally:
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_transports_keyed_by_http_version(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        negotiated = get_async_transport(config)
        http1 = get_async_transport(config, http2=False)
        envd_negotiated = get_async_envd_transport(config)
        envd_http1 = get_async_envd_transport(config, http2=False)

        assert http1 is not negotiated
        assert envd_http1 is not envd_negotiated
        # A config without sandbox headers resolves envd to shard zero, so it
        # shares the generic transport for each HTTP version.
        assert envd_negotiated is negotiated
        assert envd_http1 is http1
        assert get_async_transport(config, http2=False) is http1
        assert get_async_transport(config) is negotiated
        assert get_async_envd_transport(config, http2=False) is envd_http1
        assert (
            get_async_envd_transport(config, http2=False, for_streaming=True)
            is not envd_http1
        )
    finally:
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_transports_are_consistently_sharded_by_sandbox(
    test_api_key, monkeypatch
):
    monkeypatch.setattr(api, "envd_pool_shards", 4)
    reset_transport_caches()
    first = sandbox_config(test_api_key, "sbx-0")
    same_shard = sandbox_config(test_api_key, "sbx-2")
    different_shard = sandbox_config(test_api_key, "sbx-1")

    try:
        assert get_async_envd_transport(first) is get_async_envd_transport(same_shard)
        assert get_async_envd_transport(first) is not get_async_envd_transport(
            different_shard
        )
        assert get_async_envd_transport(first) is not get_async_transport(first)
    finally:
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_transports_pass_http_version_to_pyqwest(test_api_key, monkeypatch):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    captured = []
    build_transport = api_client_async.HTTPTransport

    def record(**kwargs):
        captured.append(kwargs["http_version"])
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_async, "HTTPTransport", record)

    try:
        get_async_transport(config)
        get_async_transport(config, http2=False)
        # A third pool: same version as the call above, different idle bound.
        get_async_envd_transport(config, http2=False, for_streaming=True)

        assert captured == [None, HTTPVersion.HTTP1, HTTPVersion.HTTP1]
    finally:
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_transport_passes_pool_tuning_to_pyqwest(test_api_key, monkeypatch):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    captured = {}
    build_transport = api_client_async.HTTPTransport

    def record(**kwargs):
        captured.update(kwargs)
        return build_transport(**kwargs)

    monkeypatch.setattr(api_client_async, "HTTPTransport", record)

    try:
        get_async_transport(config, for_streaming=True)

        assert captured["tls_include_system_certs"] is True
        assert captured["proxy"] is None
        assert captured["pool_idle_timeout"] == pool_idle_timeout
        assert captured["pool_max_idle_per_host"] == pool_max_idle_per_host
        assert captured["read_timeout"] == READ_TIMEOUT
        assert captured["follow_redirects"] is False
    finally:
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_is_shared_across_loops(test_api_key):
    # pyqwest's I/O runs on its own Rust runtime, so neither the transport
    # nor the httpx client wrapper is bound to an event loop — a single
    # client serves all loops (the per-loop client caching this replaced is
    # gone).
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    api_client = get_async_api_client(config)

    async def get_client():
        return api_client.get_async_httpx_client()

    try:
        main_client = api_client.get_async_httpx_client()
        other_loop_client = await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: asyncio.run(get_client()),
        )

        assert api_client.get_async_httpx_client() is main_client
        assert other_loop_client is main_client
    finally:
        await main_client.aclose()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_generic_transport_separates_streaming_read_timeout(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        api_transport = get_async_transport(config)
        streaming_transport = get_async_transport(config, for_streaming=True)

        assert isinstance(api_transport, AsyncPyqwestTransport)
        assert api_transport is get_async_transport(config, for_streaming=False)
        assert streaming_transport is not api_transport
        assert get_async_transport(config, for_streaming=True) is streaming_transport
    finally:
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_envd_api_client_wiring(test_api_key):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)

    client = get_async_envd_api(config, "https://sandbox.e2b.app")

    try:
        assert client.base_url == "https://sandbox.e2b.app"
        assert client._transport is get_async_transport(config)
        for header, value in config.sandbox_headers.items():
            assert client.headers[header] == value
    finally:
        await client.aclose()
        reset_transport_caches()


class _EchoHandler(BaseHTTPRequestHandler):
    """Answers every GET with a JSON echo of the request headers; a path
    starting with ``/slow`` sleeps 5 seconds first, one starting with
    ``/stall`` answers the head and then never sends the body, and one starting
    with ``/redirect`` answers 302 pointing at ``/sandboxes``."""

    def do_GET(self):
        if self.path.startswith("/slow"):
            time.sleep(5)
        if self.path.startswith("/redirect"):
            self.send_response(302)
            self.send_header("Location", "/sandboxes")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        headers = {k.lower(): v for k, v in self.headers.items()}
        body = json.dumps({"path": self.path, "headers": headers}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.path.startswith("/stall"):
            self.wfile.flush()
            time.sleep(5)
            return
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        received = self.rfile.read(length) if length else b""
        body = json.dumps({"received": len(received)}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class _EchoServer(ThreadingHTTPServer):
    # The concurrency tests open 32 connections at once. Windows resets
    # connections that overflow the listen backlog (request_queue_size,
    # default 5) instead of queueing them, which surfaces as a flaky
    # "connection was forcibly closed" WriteError mid-test.
    request_queue_size = 64


@pytest.fixture
def echo_server():
    server = _EchoServer(("127.0.0.1", 0), _EchoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join()


def test_sync_transport_sends_proxy_credentials_and_headers(test_api_key, echo_server):
    # Everything an httpx.Proxy can express reaches the proxy: the echo server
    # stands in for one, so the request arrives in absolute form with the
    # credentials and the extra headers configured for it.
    reset_transport_caches()
    config = ConnectionConfig(
        api_key=test_api_key,
        proxy=httpx.Proxy(
            echo_server, auth=("user", "pass"), headers={"X-Proxy-Token": "t"}
        ),
    )
    client = httpx.Client(transport=get_sync_transport(config))

    try:
        echoed = client.get("http://proxied.invalid/health").json()
        assert echoed["path"] == "http://proxied.invalid/health"
        assert echoed["headers"]["proxy-authorization"] == (
            "Basic " + base64.b64encode(b"user:pass").decode()
        )
        assert echoed["headers"]["x-proxy-token"] == "t"
    finally:
        client.close()
        reset_transport_caches()


def test_transport_emits_pyqwest_access_log(test_api_key, echo_server, caplog):
    # pyqwest logs every request on `pyqwest.access` at DEBUG — the
    # transport-level diagnostics httpcore used to provide, and separate from
    # the SDK's own `logger` option.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        with caplog.at_level(logging.DEBUG, logger="pyqwest.access"):
            assert httpx_client.request("GET", "/sandboxes").status_code == 200

        messages = [
            r.getMessage() for r in caplog.records if r.name == "pyqwest.access"
        ]
        # The stdlib test server answers HTTP/1.0.
        assert messages == [
            f'HTTP Request: GET {echo_server}/sandboxes "HTTP/1.0 200 OK"'
        ]
    finally:
        httpx_client.close()
        reset_transport_caches()


def test_sync_api_client_round_trips_through_pyqwest(test_api_key, echo_server):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert isinstance(httpx_client._transport, PyqwestTransport)
        response = httpx_client.request("GET", "/sandboxes")
        assert response.status_code == 200
        echoed = response.json()
        assert echoed["path"] == "/sandboxes"
        assert echoed["headers"]["x-api-key"] == test_api_key
        assert echoed["headers"]["package_version"]
    finally:
        httpx_client.close()
        reset_transport_caches()


def test_sync_api_client_serves_concurrent_threads(test_api_key, echo_server):
    # The scenario the removed per-thread client caching used to guard: one
    # client, one shared pyqwest pool, many threads at once.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    def request(i: int) -> tuple[int, str]:
        response = httpx_client.request("GET", f"/sandboxes/{i}")
        return response.status_code, response.json()["path"]

    try:
        with ThreadPoolExecutor(max_workers=16) as executor:
            results = list(executor.map(request, range(32)))

        assert results == [(200, f"/sandboxes/{i}") for i in range(32)]
    finally:
        httpx_client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_serves_concurrent_requests(test_api_key, echo_server):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    async def request(i: int) -> tuple[int, str]:
        response = await httpx_client.request("GET", f"/sandboxes/{i}")
        return response.status_code, response.json()["path"]

    try:
        results = await asyncio.gather(*(request(i) for i in range(32)))
        assert list(results) == [(200, f"/sandboxes/{i}") for i in range(32)]
    finally:
        await httpx_client.aclose()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_round_trips_through_pyqwest(test_api_key, echo_server):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        assert isinstance(httpx_client._transport, AsyncPyqwestTransport)
        response = await httpx_client.request("GET", "/sandboxes")
        assert response.status_code == 200
        echoed = response.json()
        assert echoed["path"] == "/sandboxes"
        assert echoed["headers"]["x-api-key"] == test_api_key
        assert echoed["headers"]["package_version"]
    finally:
        await httpx_client.aclose()
        reset_transport_caches()


def test_sync_api_client_leaves_redirects_to_httpx(test_api_key, echo_server):
    # reqwest would otherwise follow redirects inside the transport, hiding them
    # from httpx: the generated client asks for no redirect following, so a 302
    # must surface as-is, and opting in must record the hop in `history`.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.follow_redirects is False
        response = httpx_client.request("GET", "/redirect")
        assert response.status_code == 302
        assert response.headers["location"] == "/sandboxes"
        assert response.history == []

        followed = httpx_client.request("GET", "/redirect", follow_redirects=True)
        assert followed.status_code == 200
        assert followed.json()["path"] == "/sandboxes"
        assert [r.status_code for r in followed.history] == [302]
    finally:
        httpx_client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_leaves_redirects_to_httpx(test_api_key, echo_server):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        assert httpx_client.follow_redirects is False
        response = await httpx_client.request("GET", "/redirect")
        assert response.status_code == 302
        assert response.headers["location"] == "/sandboxes"
        assert response.history == []

        followed = await httpx_client.request("GET", "/redirect", follow_redirects=True)
        assert followed.status_code == 200
        assert followed.json()["path"] == "/sandboxes"
        assert [r.status_code for r in followed.history] == [302]
    finally:
        await httpx_client.aclose()
        reset_transport_caches()


def test_sync_api_client_timeout_raises_httpx_read_timeout(test_api_key, echo_server):
    # pyqwest raises the builtin TimeoutError; the transport re-raises it as
    # httpx.ReadTimeout to keep the httpx.TimeoutException contract.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            httpx_client.request("GET", "/slow", timeout=0.2)
    finally:
        httpx_client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_timeout_raises_httpx_read_timeout(
    test_api_key, echo_server
):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            await httpx_client.request("GET", "/slow", timeout=0.2)
    finally:
        await httpx_client.aclose()
        reset_transport_caches()


def test_sync_api_client_body_timeout_raises_httpx_read_timeout(
    test_api_key, echo_server
):
    # The head arrives in time and the body never does: httpx reads the body
    # after the transport returned, so that timeout is mapped on the stream.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            httpx_client.request("GET", "/stall", timeout=0.2)
    finally:
        httpx_client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_api_client_body_timeout_raises_httpx_read_timeout(
    test_api_key, echo_server
):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            await httpx_client.request("GET", "/stall", timeout=0.2)
    finally:
        await httpx_client.aclose()
        reset_transport_caches()


def test_sync_http1_transport_round_trips(test_api_key, echo_server, caplog):
    # The HTTP/1.1-pinned transport is functional, not just configured: pinning
    # a version reqwest can't use for a request would fail at connect time.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    client = httpx.Client(
        base_url=echo_server, transport=get_sync_transport(config, http2=False)
    )

    try:
        with caplog.at_level(logging.DEBUG, logger="pyqwest.access"):
            response = client.get("/sandboxes")

        assert response.status_code == 200
        assert response.json()["path"] == "/sandboxes"
        # pyqwest logs the response's version (the stdlib test server answers
        # HTTP/1.0); `httpx.Response.http_version` is not meaningful through the
        # adapter, which reports HTTP/1.1 either way.
        assert f'GET {echo_server}/sandboxes "HTTP/1.0 200 OK"' in caplog.text
    finally:
        client.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_http1_transport_round_trips(test_api_key, echo_server):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    client = httpx.AsyncClient(
        base_url=echo_server, transport=get_async_transport(config, http2=False)
    )

    try:
        response = await client.get("/sandboxes")

        assert response.status_code == 200
        assert response.json()["path"] == "/sandboxes"
    finally:
        await client.aclose()
        reset_transport_caches()


def test_sync_transport_sends_multipart_bodies(test_api_key, echo_server):
    # `files=` uploads (envd `files.write`) go out as httpx's MultipartStream,
    # which implements both SyncByteStream and AsyncByteStream. The adapter's
    # sync path used to match AsyncByteStream first and raise from inside the
    # body iterator, surfacing as a WriteError mid-request; pyqwest 0.8 matches
    # the sync case first, so the SDK no longer rewraps the stream.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key)
    client = httpx.Client(base_url=echo_server, transport=get_sync_transport(config))

    try:
        response = client.post("/files", files=[("file", ("a.txt", b"x" * 4096))])
        assert response.status_code == 200
        assert response.json()["received"] > 4096
    finally:
        client.close()
        reset_transport_caches()


def test_sync_closing_one_client_leaves_the_shared_pool_open(test_api_key, echo_server):
    # Every stack draws on one pool now, so a close reaching it would take the
    # whole process' HTTP down with it: pyqwest pools are closable
    # (`SyncHTTPTransport.close`) and each httpx client holds the same cached
    # adapter over one. The adapter forwards neither `close()` nor the
    # context-manager exit the generated clients call, so closing one client
    # must leave the others — and the pool the envd RPC stack talks to
    # directly — working.
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_httpx = get_sync_api_client(config).get_httpx_client()
    envd_api = get_sync_envd_api(config, echo_server)
    pool = get_sync_pyqwest_transport(proxy_to_config(config.proxy))

    try:
        assert api_httpx._transport is envd_api._transport
        assert api_httpx.request("GET", "/sandboxes").status_code == 200

        api_httpx.close()

        assert envd_api.get("/health").status_code == 200
        rpc_response = pool.execute_sync(SyncRequest("GET", f"{echo_server}/health"))
        try:
            assert rpc_response.status == 200
        finally:
            rpc_response.close()
    finally:
        envd_api.close()
        reset_transport_caches()


@pytest.mark.asyncio
async def test_async_closing_one_client_leaves_the_shared_pool_open(
    test_api_key, echo_server
):
    reset_transport_caches()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_httpx = get_async_api_client(config).get_async_httpx_client()
    envd_api = get_async_envd_api(config, echo_server)
    pool = get_async_pyqwest_transport(proxy_to_config(config.proxy))

    try:
        assert api_httpx._transport is envd_api._transport
        assert (await api_httpx.request("GET", "/sandboxes")).status_code == 200

        await api_httpx.aclose()

        assert (await envd_api.get("/health")).status_code == 200
        rpc_response = await pool.execute(Request("GET", f"{echo_server}/health"))
        try:
            assert rpc_response.status == 200
        finally:
            await rpc_response.aclose()
    finally:
        await envd_api.aclose()
        reset_transport_caches()
