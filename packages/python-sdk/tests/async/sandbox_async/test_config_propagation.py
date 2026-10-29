import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Tuple
from unittest.mock import AsyncMock

import httpx
import pytest

from e2b import AsyncSandbox
from e2b.api import SandboxCreateResponse
from e2b.connection_config import ConnectionConfig
import e2b.sandbox_async.main as sandbox_async_main

BASE_DOMAIN = "base.e2b.dev"
BASE_REQUEST_TIMEOUT = 11
BASE_DEBUG = False
BASE_HEADERS = {"X-Test": "base"}
CONNECTED_SANDBOX = {
    "sandboxID": "sbx-test",
    "templateID": "tmpl-test",
    "clientID": "client-test",
    "envdVersion": "0.2.4",
    "envdAccessToken": "tok",
    "trafficAccessToken": "tok",
    "domain": "sandbox.e2b.dev",
}


class _FakeApiHandler(BaseHTTPRequestHandler):
    """Answers sandbox connect and pause requests and records each one."""

    requests: List[Tuple[str, str, Dict[str, str]]] = []
    delay = 0.0

    def log_message(self, *args):  # noqa: A003 - silence the default stderr log
        pass

    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length") or 0))
        type(self).requests.append(
            (self.command, self.path, {k.lower(): v for k, v in self.headers.items()})
        )
        if self.path.endswith("/connect"):
            body = json.dumps(CONNECTED_SANDBOX).encode()
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        time.sleep(type(self).delay)
        self.send_response(204)
        self.end_headers()


@pytest.fixture
def fake_api():
    """Starts local API servers; yields a factory returning their base URLs."""
    _FakeApiHandler.requests = []
    _FakeApiHandler.delay = 0.0
    servers = []

    def start() -> str:
        server = ThreadingHTTPServer(("127.0.0.1", 0), _FakeApiHandler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        servers.append(server)
        return f"http://127.0.0.1:{server.server_port}"

    try:
        yield start
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()


async def create_sandbox(
    api_key: str, api_url: str, request_timeout: float = BASE_REQUEST_TIMEOUT
) -> AsyncSandbox:
    return await AsyncSandbox.connect(
        "sbx-test",
        api_key=api_key,
        api_url=api_url,
        domain=BASE_DOMAIN,
        request_timeout=request_timeout,
        debug=BASE_DEBUG,
        api_headers=BASE_HEADERS,
        retries=0,
    )


def pause_requests_to(api_url: str) -> List[Dict[str, str]]:
    port = api_url.rsplit(":", 1)[1]
    return [
        headers
        for method, path, headers in _FakeApiHandler.requests
        if method == "POST"
        and path == "/sandboxes/sbx-test/pause"
        and headers["host"].endswith(f":{port}")
    ]


@pytest.mark.skip_debug()
async def test_pause_passes_connection_config_without_overrides(fake_api, test_api_key):
    api_url = fake_api()
    sandbox = await create_sandbox(test_api_key, api_url)

    assert await sandbox.pause() is True

    [headers] = pause_requests_to(api_url)
    assert headers["x-api-key"] == test_api_key
    assert headers["x-test"] == BASE_HEADERS["X-Test"]


@pytest.mark.skip_debug()
async def test_pause_applies_overrides(fake_api, test_api_key):
    base_api_url = fake_api()
    override_api_url = fake_api()
    sandbox = await create_sandbox(test_api_key, base_api_url)

    assert (
        await sandbox.pause(api_url=override_api_url, api_headers={"X-Extra": "1"})
        is True
    )

    assert pause_requests_to(base_api_url) == []
    [headers] = pause_requests_to(override_api_url)
    assert headers["x-api-key"] == test_api_key
    assert headers["x-test"] == BASE_HEADERS["X-Test"]
    assert headers["x-extra"] == "1"


@pytest.mark.skip_debug()
async def test_pause_request_timeout_override_wins(fake_api, test_api_key):
    _FakeApiHandler.delay = 0.5
    sandbox = await create_sandbox(test_api_key, fake_api(), request_timeout=0.1)

    # The control-plane client surfaces the raw httpx timeout.
    with pytest.raises(httpx.TimeoutException):
        await sandbox.pause()

    assert await sandbox.pause(request_timeout=5) is True


@pytest.mark.skip_debug()
async def test_connect_sets_stable_host_routing_headers(monkeypatch, test_api_key):
    mock_connect = AsyncMock(
        return_value=SandboxCreateResponse(
            sandbox_id="sbx-test",
            sandbox_domain="e2b.app",
            envd_version="0.4.0",
            envd_access_token="tok",
            traffic_access_token="traffic",
        )
    )
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_connect)

    monkeypatch.setattr(ConnectionConfig, "_integration", "testing/version")
    config = ConnectionConfig(
        api_key=test_api_key,
        api_headers=BASE_HEADERS,
    )
    sandbox = await AsyncSandbox.connect(
        "sbx-test",
        **config.get_api_params(),
    )

    assert sandbox.envd_api_url == "https://sandbox.e2b.app"
    assert "X-Test" not in sandbox.connection_config.sandbox_headers
    assert sandbox.connection_config.sandbox_headers["User-Agent"].startswith(
        "e2b-python-sdk/"
    )
    assert sandbox.connection_config.sandbox_headers["User-Agent"].endswith(
        " testing/version"
    )
    assert sandbox.connection_config.sandbox_headers["E2b-Sandbox-Id"] == "sbx-test"
    assert sandbox.connection_config.sandbox_headers["E2b-Sandbox-Port"] == str(
        ConnectionConfig.envd_port
    )
    assert sandbox.connection_config.sandbox_headers["X-Access-Token"] == "tok"
