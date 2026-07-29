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
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport

import e2b.api.client_async as client_async
import e2b.api.client_sync as client_sync
from e2b.api.client_async import AsyncEnvdTransportWithLogger
from e2b.api.client_async import get_api_client as get_async_api_client
from e2b.api.client_async import get_envd_transport as get_async_envd_transport
from e2b.api.client_async import get_transport as get_async_transport
from e2b.api.client_sync import EnvdTransportWithLogger
from e2b.api.client_sync import get_api_client as get_sync_api_client
from e2b.api.client_sync import get_envd_transport as get_sync_envd_transport
from e2b.api.client_sync import get_transport as get_sync_transport
from e2b.connection_config import ConnectionConfig


def reset_sync_api_transports():
    client_sync._transports.clear()


def reset_async_api_transports():
    client_async._transports.clear()


def reset_sync_envd_transports():
    EnvdTransportWithLogger._thread_local.instances = {}


def run_in_worker_thread(fn):
    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(fn).result()


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
    # envd file transfers stay on the httpx-native transports (envd RPC has
    # its own pyqwest pool under connectrpc); REST API calls go through the
    # pyqwest httpx adapter.
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
    reset_sync_api_transports()
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
        reset_sync_api_transports()


def test_transport_emits_pyqwest_access_log(test_api_key, echo_server, caplog):
    # pyqwest logs every request on `pyqwest.access` at DEBUG — the
    # transport-level diagnostics httpcore used to provide, and separate from
    # the SDK's own `logger` option.
    reset_sync_api_transports()
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
        reset_sync_api_transports()


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


def test_sync_api_client_leaves_redirects_to_httpx(test_api_key, echo_server):
    # reqwest would otherwise follow redirects inside the transport, hiding them
    # from httpx: the generated client asks for no redirect following, so a 302
    # must surface as-is, and opting in must record the hop in `history`.
    reset_sync_api_transports()
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
        reset_sync_api_transports()


@pytest.mark.asyncio
async def test_async_api_client_leaves_redirects_to_httpx(test_api_key, echo_server):
    reset_async_api_transports()
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
        reset_async_api_transports()


def test_sync_api_client_timeout_raises_httpx_read_timeout(test_api_key, echo_server):
    # pyqwest raises the builtin TimeoutError; the transport re-raises it as
    # httpx.ReadTimeout to keep the httpx.TimeoutException contract.
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            httpx_client.request("GET", "/slow", timeout=0.2)
    finally:
        httpx_client.close()
        reset_sync_api_transports()


@pytest.mark.asyncio
async def test_async_api_client_timeout_raises_httpx_read_timeout(
    test_api_key, echo_server
):
    reset_async_api_transports()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            await httpx_client.request("GET", "/slow", timeout=0.2)
    finally:
        await httpx_client.aclose()
        reset_async_api_transports()


def test_sync_api_client_body_timeout_raises_httpx_read_timeout(
    test_api_key, echo_server
):
    # The head arrives in time and the body never does: httpx reads the body
    # after the transport returned, so that timeout is mapped on the stream.
    reset_sync_api_transports()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_sync_api_client(config)
    httpx_client = api_client.get_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            httpx_client.request("GET", "/stall", timeout=0.2)
    finally:
        httpx_client.close()
        reset_sync_api_transports()


@pytest.mark.asyncio
async def test_async_api_client_body_timeout_raises_httpx_read_timeout(
    test_api_key, echo_server
):
    reset_async_api_transports()
    config = ConnectionConfig(api_key=test_api_key, api_url=echo_server)
    api_client = get_async_api_client(config)
    httpx_client = api_client.get_async_httpx_client()

    try:
        with pytest.raises(httpx.ReadTimeout):
            await httpx_client.request("GET", "/stall", timeout=0.2)
    finally:
        await httpx_client.aclose()
        reset_async_api_transports()
