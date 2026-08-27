import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, List, Tuple

import pytest

from e2b import (
    E2B,
    AsyncSandbox,
    AsyncSecret,
    AsyncTemplate,
    AsyncVolume,
    Sandbox,
    Secret,
    Template,
    Volume,
)
from e2b.connection_config import bind_client_params

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

SECRET_RESPONSE = {
    "secretID": "secret-test",
    "name": "secret",
    "currentVersion": 1,
    "metadata": {},
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
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
        elif self.path.startswith("/secrets"):
            self._record_and_respond(201, SECRET_RESPONSE)
        else:
            self._record_and_respond(404, {"code": 404, "message": "not found"})

    def do_GET(self):
        if self.path.startswith("/v2/sandboxes"):
            self._record_and_respond(200, [])
        elif self.path.startswith("/volumes"):
            self._record_and_respond(200, [])
        elif self.path.startswith("/templates/aliases/"):
            self._record_and_respond(
                200,
                {"aliases": [], "templateID": "tmpl-test", "public": False},
            )
        elif self.path.startswith("/templates/"):
            self._record_and_respond(200, [])
        elif self.path == "/secrets":
            self._record_and_respond(200, [SECRET_RESPONSE])
        elif self.path.startswith("/secrets/"):
            self._record_and_respond(200, SECRET_RESPONSE)
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


def test_per_call_params_set_to_none_keep_the_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    sandbox = client.Sandbox.create(api_key=None, domain=None)
    assert sandbox.connection_config.api_key == API_KEY_A
    assert sandbox.connection_config.domain == DOMAIN_A

    client.Sandbox.list().next_items(api_key=None)
    assert api_keys() == [API_KEY_A, API_KEY_A]


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


def test_client_template_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    assert issubclass(client.Template, Template)
    assert client.Template.exists("tmpl") is True
    client.Template.get_tags("tmpl-test")

    assert api_keys() == [API_KEY_A, API_KEY_A]
    # Per-call params still win.
    client.Template.get_tags("tmpl-test", api_key=API_KEY_B)
    assert api_keys()[-1] == API_KEY_B


def test_client_template_builder_is_usable(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    template = client.Template().from_python_image("3")

    assert client.Template.to_dockerfile(template) == Template.to_dockerfile(
        Template().from_python_image("3")
    )


def test_async_client_template_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    async def run():
        return await client.AsyncTemplate.exists("tmpl")

    assert issubclass(client.AsyncTemplate, AsyncTemplate)
    assert asyncio.run(run()) is True
    assert api_keys() == [API_KEY_A]


def test_client_secret_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    assert issubclass(client.Secret, Secret)

    client.Secret.create("secret", "value")
    client.Secret.get_info("secret")
    client.Secret.list().next_items()

    assert api_keys() == [API_KEY_A, API_KEY_A, API_KEY_A]
    # Per-call params still win, and `None` does not erase the client's.
    client.Secret.get_info("secret", api_key=API_KEY_B)
    assert api_keys()[-1] == API_KEY_B
    client.Secret.get_info("secret", api_key=None)
    assert api_keys()[-1] == API_KEY_A


def test_client_async_secret_uses_client_config(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)

    async def run():
        return await client.AsyncSecret.exists("secret")

    assert issubclass(client.AsyncSecret, AsyncSecret)
    assert asyncio.run(run()) is True
    assert api_keys() == [API_KEY_A]


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
    assert Template._bound_api_params == {}
    assert AsyncTemplate._bound_api_params == {}
    assert Secret._bound_api_params == {}
    assert AsyncSecret._bound_api_params == {}

    assert Template.exists("tmpl", api_url=api_server) is True
    assert api_keys()[-1] == ENV_API_KEY


def test_client_params_are_copied(api_server):
    opts = {"api_key": API_KEY_A, "domain": DOMAIN_A, "api_url": api_server}
    client = E2B(**opts)
    opts["api_key"] = API_KEY_B

    sandbox = client.Sandbox.create()

    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.api_key == API_KEY_A


def test_with_params_returns_a_new_client_with_merged_params(api_server):
    client = E2B(api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server)
    overridden = client.with_params(domain=DOMAIN_B)

    sandbox = overridden.Sandbox.create()

    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.api_key == API_KEY_A
    assert sandbox.connection_config.domain == DOMAIN_B
    # The original client keeps its own params.
    assert client.Sandbox._bound_api_params["domain"] == DOMAIN_A


def test_resource_with_params_returns_a_bound_class_with_merged_params(api_server):
    BoundSandbox = Sandbox.with_params(
        api_key=API_KEY_A, domain=DOMAIN_A, api_url=api_server
    )
    ReboundSandbox = BoundSandbox.with_params(domain=DOMAIN_B)

    sandbox = ReboundSandbox.create()

    assert api_keys() == [API_KEY_A]
    assert sandbox.connection_config.api_key == API_KEY_A
    assert sandbox.connection_config.domain == DOMAIN_B
    # The original classes keep their own bound params.
    assert BoundSandbox._bound_api_params["domain"] == DOMAIN_A
    assert Sandbox._bound_api_params == {}


def test_bind_client_params_merges_with_already_bound_params():
    bound = bind_client_params(Sandbox, api_key=API_KEY_A, domain=DOMAIN_A)
    rebound = bind_client_params(bound, domain=DOMAIN_B)

    assert rebound._bound_api_params == {"api_key": API_KEY_A, "domain": DOMAIN_B}
    # The original class keeps its own bound params.
    assert bound._bound_api_params == {"api_key": API_KEY_A, "domain": DOMAIN_A}
