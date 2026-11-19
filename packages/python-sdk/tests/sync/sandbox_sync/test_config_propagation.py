import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Tuple

import httpx
import pytest
from local_api_server import connect_recording_proxy

from e2b import Sandbox
from e2b.connection_config import ConnectionConfig

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


def create_sandbox(
    api_key: str, api_url: str, request_timeout: float = BASE_REQUEST_TIMEOUT
) -> Sandbox:
    return Sandbox.connect(
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
def test_pause_passes_connection_config_without_overrides(fake_api, test_api_key):
    api_url = fake_api()
    sandbox = create_sandbox(test_api_key, api_url)

    assert sandbox.pause() is True

    [headers] = pause_requests_to(api_url)
    assert headers["x-api-key"] == test_api_key
    assert headers["x-test"] == BASE_HEADERS["X-Test"]


@pytest.mark.skip_debug()
def test_pause_applies_header_overrides(fake_api, test_api_key):
    api_url = fake_api()
    sandbox = create_sandbox(test_api_key, api_url)

    assert sandbox.pause(api_headers={"X-Extra": "1"}) is True

    [headers] = pause_requests_to(api_url)
    assert headers["x-api-key"] == test_api_key
    assert headers["x-test"] == BASE_HEADERS["X-Test"]
    assert headers["x-extra"] == "1"


@pytest.mark.skip_debug()
@pytest.mark.xfail(
    strict=True, reason="SDK-412: per-call domain is ignored on instance methods"
)
def test_pause_domain_override_wins(test_api_key):
    # A debug connect skips the API, so the instance's API URL stays the one
    # derived from its domain (as after a real create/connect), not explicit.
    sandbox = Sandbox.connect(
        "sbx-test", api_key=test_api_key, domain=BASE_DOMAIN, debug=True
    )

    with connect_recording_proxy() as (proxy, targets):
        # The proxy refuses the tunnel, so the call fails; only the target matters.
        with pytest.raises(Exception):
            sandbox.pause(domain="override.e2b.dev", debug=False, proxy=proxy)

    # Connection-level retries may open the tunnel more than once.
    assert targets and set(targets) == {"api.override.e2b.dev:443"}


@pytest.mark.skip_debug()
def test_pause_request_timeout_override_wins(fake_api, test_api_key):
    _FakeApiHandler.delay = 0.5
    sandbox = create_sandbox(test_api_key, fake_api(), request_timeout=0.1)

    # The control-plane client surfaces the raw httpx timeout.
    with pytest.raises(httpx.TimeoutException):
        sandbox.pause()

    assert sandbox.pause(request_timeout=5) is True


class _FakeEnvdHandler(BaseHTTPRequestHandler):
    """Answers envd file reads and records each request's headers."""

    headers_seen: List[Dict[str, str]] = []

    def log_message(self, *args):  # noqa: A003 - silence the default stderr log
        pass

    def do_GET(self):
        type(self).headers_seen.append({k.lower(): v for k, v in self.headers.items()})
        body = b"hello"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture
def fake_envd():
    _FakeEnvdHandler.headers_seen = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _FakeEnvdHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()


@pytest.mark.skip_debug()
def test_connect_sends_stable_host_routing_headers_to_envd(
    fake_api, fake_envd, test_api_key
):
    sandbox = Sandbox.connect(
        "sbx-test",
        api_key=test_api_key,
        api_url=fake_api(),
        sandbox_url=fake_envd,
        api_headers=BASE_HEADERS,
    )

    assert sandbox.files.read("/hello.txt") == "hello"

    [headers] = _FakeEnvdHandler.headers_seen
    assert "x-test" not in headers
    assert headers["user-agent"].startswith("e2b-python-sdk/")
    assert headers["e2b-sandbox-id"] == "sbx-test"
    assert headers["e2b-sandbox-port"] == str(ConnectionConfig.envd_port)
    assert headers["x-access-token"] == "tok"
