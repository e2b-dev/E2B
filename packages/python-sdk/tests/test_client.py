import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Tuple

import pytest

from e2b import (
    E2B,
    AsyncSandbox,
    AsyncVolume,
    Sandbox,
    Secret,
    Volume,
)

API_KEY_A = "e2b_" + "a" * 40
API_KEY_B = "e2b_" + "b" * 40
ENV_API_KEY = "e2b_" + "e" * 40

DOMAIN_A = "client-a.example.com"
DOMAIN_B = "client-b.example.com"
ENV_DOMAIN = "env.example.com"

SANDBOX_RESPONSE = {
    "templateID": "base",
    "sandboxID": "sbx-test",
    "clientID": "client-test",
    "envdVersion": "0.2.0",
}


class _Handler(BaseHTTPRequestHandler):
    requests: List[Tuple[str, str, Dict[str, str]]] = []

    def log_message(self, *args):  # noqa: A003 - silence the default stderr log
        pass

    def _record_and_respond(self, status: int, body):
        type(self).requests.append(
            (self.command, self.path, {k.lower(): v for k, v in self.headers.items()})
        )
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            self.rfile.read(length)

        if self.path.startswith("/sandboxes"):
            self._record_and_respond(201, SANDBOX_RESPONSE)
        elif self.path.startswith("/volumes"):
            self._record_and_respond(
                201,
                {"volumeID": "vol-test", "name": "vol", "token": "vol-token"},
            )
        else:
            self._record_and_respond(404, {"code": 404, "message": "not found"})

    def do_GET(self):
        if self.path.startswith("/volumes"):
            self._record_and_respond(200, [])
        else:
            self._record_and_respond(404, {"code": 404, "message": "not found"})


@pytest.fixture
def api_server(monkeypatch):
    """Local API server, with the env config pointed away from any client's."""
    monkeypatch.setenv("E2B_API_KEY", ENV_API_KEY)
    monkeypatch.setenv("E2B_DOMAIN", ENV_DOMAIN)

    _Handler.requests = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def requests() -> List[Tuple[str, str, Dict[str, str]]]:
    return _Handler.requests


def api_keys() -> List[str]:
    return [headers.get("x-api-key", "") for _, _, headers in requests()]


def test_client_sandbox_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    sandbox = client.Sandbox.create()

    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.domain == DOMAIN_A
    assert sandbox.connection_config.api_key == API_KEY_A


def test_client_sandbox_is_a_subclass(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    assert issubclass(client.Sandbox, Sandbox)
    assert client.Sandbox is not Sandbox
    assert isinstance(client.Sandbox.create(), client.Sandbox)
    # Class-level defaults are inherited.
    assert client.Sandbox.default_template == Sandbox.default_template
    assert client.Sandbox.default_mcp_template == Sandbox.default_mcp_template
    assert client.Sandbox.default_sandbox_timeout == Sandbox.default_sandbox_timeout


def test_per_call_params_override_the_client(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    sandbox = client.Sandbox.create(api_key=API_KEY_B, domain=DOMAIN_B)

    assert api_keys() == [API_KEY_B]
    assert sandbox.connection_config.domain == DOMAIN_B


def test_client_class_can_be_rebound(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    S = client.Sandbox
    sandbox = S.create()

    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.api_key == API_KEY_A


def test_two_clients_stay_isolated(api_server):
    client_a = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)
    client_b = E2B(api_key=API_KEY_B, domain=DOMAIN_B, api_url=api_server)

    sandbox_a = client_a.Sandbox.create()
    sandbox_b = client_b.Sandbox.create()

    assert api_keys() == [API_KEY_A, API_KEY_B]
    assert sandbox_a.connection_config.domain == DOMAIN_A
    assert sandbox_b.connection_config.domain == DOMAIN_B


def test_async_client_sandbox_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    async def run():
        return await client.AsyncSandbox.create()

    sandbox = asyncio.run(run())

    assert issubclass(client.AsyncSandbox, AsyncSandbox)
    assert isinstance(sandbox, client.AsyncSandbox)
    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.api_key == API_KEY_A
    assert sandbox.connection_config.domain == DOMAIN_A


def test_client_volume_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    volume = client.Volume.create("vol")
    client.Volume.list()

    assert issubclass(client.Volume, Volume)
    assert isinstance(volume, client.Volume)
    assert api_keys() == [API_KEY_A, API_KEY_A]


def test_async_client_volume_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    async def run():
        volume = await client.AsyncVolume.create("vol")
        await client.AsyncVolume.list()
        return volume

    volume = asyncio.run(run())

    assert issubclass(client.AsyncVolume, AsyncVolume)
    assert isinstance(volume, client.AsyncVolume)
    assert api_keys() == [API_KEY_A, API_KEY_A]


def test_client_secret_is_the_top_level_class(api_server):
    client = E2B(api_key=API_KEY_A, api_url=api_server)

    assert client.Secret is Secret


def test_top_level_classes_keep_using_the_env_config(api_server):
    sandbox = Sandbox.create(api_url=api_server)

    assert api_keys() == [ENV_API_KEY]
    assert sandbox.connection_config.api_key == ENV_API_KEY
    assert sandbox.connection_config.domain == ENV_DOMAIN
    # Creating clients does not bind anything onto the top-level classes.
    assert Sandbox._bound_api_params == {}
    assert AsyncSandbox._bound_api_params == {}
    assert Volume._bound_api_params == {}
    assert AsyncVolume._bound_api_params == {}


def test_client_params_are_copied(api_server):
    opts = {"api_key": API_KEY_A, "domain": DOMAIN_A, "api_url": api_server}
    client = E2B(**opts)
    opts["api_key"] = API_KEY_B

    sandbox = client.Sandbox.create()

    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.api_key == API_KEY_A
