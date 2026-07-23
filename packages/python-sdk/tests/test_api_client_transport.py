import asyncio
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import cast

import httpx
import pytest
from pyqwest import (
    Headers,
    Request,
    Response,
    SyncRequest,
    SyncResponse,
    SyncTransport,
    Transport,
)
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport

import e2b.api.client_async as client_async
import e2b.api.client_sync as client_sync
from e2b.api import proxy_to_url
from e2b.api.client_async import AsyncEnvdTransportWithLogger
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_envd_transport as get_async_envd_transport
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_sync import EnvdTransportWithLogger
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.api.client_sync import get_envd_transport as get_sync_envd_transport
from e2b.api.client_sync import get_transport as get_sync_transport
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import InvalidArgumentException


def reset_sync_api_transports():
    client_sync._transports.clear()


def reset_async_api_transports():
    client_async._transports.clear()


def reset_sync_envd_transports():
    EnvdTransportWithLogger._thread_local.instances = {}


def run_in_worker_thread(fn):
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(fn).result()


def test_proxy_to_url_narrows_to_url_strings():
    assert proxy_to_url(None) is None
    assert proxy_to_url("http://127.0.0.1:9999") == "http://127.0.0.1:9999"
    assert proxy_to_url(httpx.URL("http://127.0.0.1:9999")) == "http://127.0.0.1:9999"
    with pytest.raises(InvalidArgumentException):
        proxy_to_url(httpx.Proxy("http://127.0.0.1:9999"))


def test_connection_retry_policy_retries_only_connection_errors():
    # The inner transport is never invoked by should_retry_response.
    sync_policy = client_sync.ConnectionRetryTransport(cast(SyncTransport, object()))
    async_policy = client_async.ConnectionRetryTransport(cast(Transport, object()))
    sync_request = SyncRequest("GET", "https://example.com")
    async_request = Request("GET", "https://example.com")

    assert sync_policy.should_retry_response(sync_request, ConnectionError("refused"))
    # TimeoutError is an OSError but not a ConnectionError: the request
    # may have been written, so it must not be replayed.
    assert not sync_policy.should_retry_response(sync_request, TimeoutError())
    assert not sync_policy.should_retry_response(sync_request, RuntimeError())

    assert async_policy.should_retry_response(async_request, ConnectionError("refused"))
    assert not async_policy.should_retry_response(async_request, TimeoutError())
    assert not async_policy.should_retry_response(async_request, RuntimeError())


def test_sync_api_transport_strips_host_header():
    # Forwarding httpx's auto-added Host header on an HTTP/2 connection makes
    # the E2B API edge reset the stream with PROTOCOL_ERROR; hyper derives
    # Host/:authority from the URL instead.
    captured = {}

    class FakeInner:
        def execute_sync(self, request):
            captured["headers"] = dict(request.headers.items())
            return SyncResponse(status=200, headers=Headers(()), content=b"")

    transport = client_sync.ApiPyqwestTransport(FakeInner())
    request = httpx.Request("GET", "https://api.example.com/health")
    assert "host" in request.headers

    response = transport.handle_request(request)

    assert response.status_code == 200
    assert "host" not in captured["headers"]


@pytest.mark.asyncio
async def test_async_api_transport_strips_host_header():
    captured = {}

    class FakeInner:
        async def execute(self, request):
            captured["headers"] = dict(request.headers.items())
            return Response(status=200, headers=Headers(()), content=b"")

    transport = client_async.AsyncApiPyqwestTransport(FakeInner())
    request = httpx.Request("GET", "https://api.example.com/health")
    assert "host" in request.headers

    response = await transport.handle_async_request(request)

    assert response.status_code == 200
    assert "host" not in captured["headers"]


def test_sync_api_client_proxy_uses_explicit_transport(test_api_key):
    reset_sync_api_transports()
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
        reset_sync_api_transports()


def test_sync_get_transport_keyed_by_proxy(test_api_key):
    reset_sync_api_transports()
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
        reset_sync_api_transports()


def test_sync_api_client_applies_request_timeout(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=1.5)

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(1.5)
    finally:
        httpx_client.close()
        reset_sync_api_transports()


def test_sync_api_client_request_timeout_zero_disables_timeout(test_api_key):
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key, request_timeout=0)

    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        assert httpx_client.timeout == httpx.Timeout(None)
    finally:
        httpx_client.close()
        reset_sync_api_transports()


def test_sync_envd_transport_uses_separate_stack(test_api_key):
    # envd file-transfer traffic stays on the httpx-native transport (its RPC
    # migration is a separate change); only REST API calls go through pyqwest.
    reset_sync_api_transports()
    reset_sync_envd_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        api_transport = get_sync_transport(config)
        envd_transport = get_sync_envd_transport(config)

        assert isinstance(api_transport, PyqwestTransport)
        assert isinstance(envd_transport, httpx.HTTPTransport)
        assert get_sync_transport(config) is api_transport
        assert get_sync_envd_transport(config) is envd_transport
        envd_pool = envd_transport._pool
        assert envd_pool._http2 is True  # ty: ignore[possibly-missing-attribute]
    finally:
        reset_sync_api_transports()
        reset_sync_envd_transports()


def test_sync_api_client_is_shared_across_threads(test_api_key):
    # httpx.Client is thread-safe and the pyqwest transport underneath is
    # too, so a single client (and its pool) serves all threads — the
    # per-thread client caching this replaced is gone.
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key)
    api_client = get_sync_api_client(config)

    try:
        main_client = api_client.get_httpx_client()
        worker_client = run_in_worker_thread(api_client.get_httpx_client)

        assert api_client.get_httpx_client() is main_client
        assert worker_client is main_client
    finally:
        main_client.close()
        reset_sync_api_transports()


def test_sync_envd_transport_cache_is_thread_local(test_api_key):
    reset_sync_envd_transports()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        main_transport = get_sync_envd_transport(config)
        thread_transport = run_in_worker_thread(lambda: get_sync_envd_transport(config))

        assert main_transport is get_sync_envd_transport(config)
        assert thread_transport is not main_transport
        main_pool = main_transport._pool
        assert main_pool._http2 is True  # ty: ignore[possibly-missing-attribute]
        assert thread_transport._pool._http2 is True
    finally:
        reset_sync_envd_transports()


@pytest.mark.asyncio
async def test_async_api_client_proxy_uses_explicit_transport(test_api_key):
    reset_async_api_transports()
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
        reset_async_api_transports()


@pytest.mark.asyncio
async def test_async_get_transport_keyed_by_proxy(test_api_key):
    reset_async_api_transports()
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
        reset_async_api_transports()


@pytest.mark.asyncio
async def test_async_api_client_is_shared_across_loops(test_api_key):
    # pyqwest's I/O runs on its own Rust runtime, so neither the transport
    # nor the httpx client wrapper is bound to an event loop — a single
    # client serves all loops (the per-loop client caching this replaced is
    # gone).
    reset_async_api_transports()
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
        reset_async_api_transports()


@pytest.mark.asyncio
async def test_async_envd_transport_uses_separate_stack(test_api_key):
    reset_async_api_transports()
    AsyncEnvdTransportWithLogger._instances.clear()
    config = ConnectionConfig(api_key=test_api_key)

    try:
        api_transport = get_async_transport(config)
        envd_transport = get_async_envd_transport(config)

        assert isinstance(api_transport, AsyncPyqwestTransport)
        assert isinstance(envd_transport, httpx.AsyncHTTPTransport)
        assert get_async_transport(config) is api_transport
        assert get_async_envd_transport(config) is envd_transport
        envd_pool = envd_transport._pool
        assert envd_pool._http2 is True  # ty: ignore[possibly-missing-attribute]
    finally:
        reset_async_api_transports()
        AsyncEnvdTransportWithLogger._instances.clear()


class _EchoHandler(BaseHTTPRequestHandler):
    """Answers every GET with a JSON echo of the request headers."""

    def do_GET(self):
        headers = {k.lower(): v for k, v in self.headers.items()}
        body = json.dumps({"path": self.path, "headers": headers}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


@pytest.fixture
def echo_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _EchoHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join()


def test_sync_api_client_round_trips_through_pyqwest(test_api_key, echo_server):
    reset_sync_api_transports()
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
        reset_sync_api_transports()


def test_sync_api_client_serves_concurrent_threads(test_api_key, echo_server):
    # The scenario the removed per-thread client caching used to guard: one
    # client, one shared pyqwest pool, many threads at once.
    reset_sync_api_transports()
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
        reset_sync_api_transports()


@pytest.mark.asyncio
async def test_async_api_client_serves_concurrent_requests(test_api_key, echo_server):
    reset_async_api_transports()
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
        reset_async_api_transports()


@pytest.mark.asyncio
async def test_async_api_client_round_trips_through_pyqwest(test_api_key, echo_server):
    reset_async_api_transports()
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
        reset_async_api_transports()
