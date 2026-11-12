import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import List

import pytest

from e2b import AsyncSandbox, AsyncTemplate
from e2b.exceptions import TemplateException

API_KEY = "e2b_" + "0" * 40


class _Handler(BaseHTTPRequestHandler):
    paths: List[str] = []

    def log_message(self, *args):
        pass

    def do_DELETE(self):
        type(self).paths.append(self.path)
        if self.path == "/templates/missing":
            self._respond(404, {"code": 404, "message": "Template not found"})
        elif self.path == "/templates/broken":
            self._respond(500, {"code": 500, "message": "Internal error"})
        else:
            self.send_response(204)
            self.end_headers()

    def _respond(self, status: int, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


@pytest.fixture
def api_url():
    _Handler.paths = []
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.asyncio
async def test_delete_returns_true_when_deleted(api_url):
    assert (
        await AsyncTemplate.delete("my-template", api_key=API_KEY, api_url=api_url)
        is True
    )
    assert _Handler.paths == ["/templates/my-template"]


@pytest.mark.asyncio
async def test_delete_encodes_namespaced_name(api_url):
    await AsyncTemplate.delete("my-team/my-template", api_key=API_KEY, api_url=api_url)
    assert _Handler.paths == ["/templates/my-team%2Fmy-template"]


@pytest.mark.asyncio
async def test_delete_returns_false_when_not_found(api_url):
    assert (
        await AsyncTemplate.delete("missing", api_key=API_KEY, api_url=api_url) is False
    )


@pytest.mark.asyncio
async def test_delete_raises_template_exception_on_failure(api_url):
    with pytest.raises(TemplateException):
        await AsyncTemplate.delete("broken", api_key=API_KEY, api_url=api_url)


@pytest.mark.asyncio
async def test_delete_snapshot_delegates_to_same_endpoint(api_url):
    assert await AsyncSandbox.delete_snapshot(
        "snapshot-id", api_key=API_KEY, api_url=api_url
    )
    assert not await AsyncSandbox.delete_snapshot(
        "missing", api_key=API_KEY, api_url=api_url
    )
    assert _Handler.paths == ["/templates/snapshot-id", "/templates/missing"]
