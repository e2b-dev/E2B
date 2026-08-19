import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import List, Tuple

import httpx
import pytest

from e2b import AsyncSandbox, AsyncTemplate, Sandbox, Template
from e2b.api.client.client import AuthenticatedClient
from e2b.exceptions import BuildException, FileUploadException
from e2b.sandbox_async.sandbox_api import SandboxApi as AsyncSandboxApi
from e2b.sandbox_sync.sandbox_api import SandboxApi as SyncSandboxApi
from e2b.template.types import TemplateType
from e2b.template_async import build_api as async_build_api
from e2b.template_sync import build_api as sync_build_api

NAMESPACED = "my-team/my-template"
NAMESPACED_SNAPSHOT = "team-slug/my-snapshot:default"
BASE_URL = "https://api.e2b.dev"
TEMPLATE: TemplateType = {"fromImage": "ubuntu:22.04", "steps": [], "force": False}


def _handler(request: httpx.Request) -> httpx.Response:
    if request.method == "DELETE":
        # The real endpoint answers 204 with no body.
        return httpx.Response(204)
    if request.url.path.endswith("/tags"):
        return httpx.Response(200, json=[])
    return httpx.Response(404, json={"code": 404, "message": "not found"})


def _recording_client() -> Tuple[AuthenticatedClient, List[httpx.Request]]:
    """Client whose requests are answered locally and recorded for assertions."""
    requests: List[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _handler(request)

    transport = httpx.MockTransport(record)
    client = AuthenticatedClient(base_url=BASE_URL, token="e2b_test")
    client.set_httpx_client(httpx.Client(base_url=BASE_URL, transport=transport))
    client.set_async_httpx_client(
        httpx.AsyncClient(base_url=BASE_URL, transport=transport)
    )
    return client, requests


def _request_path(request: httpx.Request) -> bytes:
    """The raw path the SDK handed to the transport, without the query string.

    `raw_path` keeps the percent-encoding (`url.path` decodes it again), which
    is the whole point of these assertions.
    """
    return request.url.raw_path.split(b"?")[0]


def test_sync_alias_check_sends_encoded_alias():
    client, requests = _recording_client()

    assert sync_build_api.check_alias_exists(client, NAMESPACED) is False

    # The slash stays encoded, so the whole alias remains a single path segment
    # instead of splitting the route.
    assert _request_path(requests[0]) == b"/templates/aliases/my-team%2Fmy-template"


def test_sync_alias_check_leaves_plain_alias_untouched():
    client, requests = _recording_client()

    assert sync_build_api.check_alias_exists(client, "my-template") is False

    assert _request_path(requests[0]) == b"/templates/aliases/my-template"


def test_sync_get_template_tags_sends_encoded_template_id():
    client, requests = _recording_client()

    assert sync_build_api.get_template_tags(client, NAMESPACED) == []

    assert _request_path(requests[0]) == b"/templates/my-team%2Fmy-template/tags"


async def test_async_alias_check_sends_encoded_alias():
    client, requests = _recording_client()

    assert await async_build_api.check_alias_exists(client, NAMESPACED) is False

    assert _request_path(requests[0]) == b"/templates/aliases/my-team%2Fmy-template"


async def test_async_alias_check_leaves_plain_alias_untouched():
    client, requests = _recording_client()

    assert await async_build_api.check_alias_exists(client, "my-template") is False

    assert _request_path(requests[0]) == b"/templates/aliases/my-template"


async def test_async_get_template_tags_sends_encoded_template_id():
    client, requests = _recording_client()

    assert await async_build_api.get_template_tags(client, NAMESPACED) == []

    assert _request_path(requests[0]) == b"/templates/my-team%2Fmy-template/tags"


# The build calls below take the template ID the API handed back rather than a
# user-typed name, so today they cannot carry a slash. They still encode it —
# these tests keep that from silently regressing if the API starts returning
# namespaced IDs. Only the request path is under test, so the mock answers the
# 404 that makes each call raise instead of a valid response body.


def test_sync_file_upload_link_sends_encoded_template_id():
    client, requests = _recording_client()

    with pytest.raises(FileUploadException):
        sync_build_api.get_file_upload_link(client, NAMESPACED, "filehash")

    assert (
        _request_path(requests[0]) == b"/templates/my-team%2Fmy-template/files/filehash"
    )


def test_sync_trigger_build_sends_encoded_template_id():
    client, requests = _recording_client()

    with pytest.raises(BuildException):
        sync_build_api.trigger_build(client, NAMESPACED, "build-id", TEMPLATE)

    assert (
        _request_path(requests[0])
        == b"/v2/templates/my-team%2Fmy-template/builds/build-id"
    )


def test_sync_build_status_sends_encoded_template_id():
    client, requests = _recording_client()

    with pytest.raises(BuildException):
        sync_build_api.get_build_status(client, NAMESPACED, "build-id", 0)

    assert (
        _request_path(requests[0])
        == b"/templates/my-team%2Fmy-template/builds/build-id/status"
    )


async def test_async_file_upload_link_sends_encoded_template_id():
    client, requests = _recording_client()

    with pytest.raises(FileUploadException):
        await async_build_api.get_file_upload_link(client, NAMESPACED, "filehash")

    assert (
        _request_path(requests[0]) == b"/templates/my-team%2Fmy-template/files/filehash"
    )


async def test_async_trigger_build_sends_encoded_template_id():
    client, requests = _recording_client()

    with pytest.raises(BuildException):
        await async_build_api.trigger_build(client, NAMESPACED, "build-id", TEMPLATE)

    assert (
        _request_path(requests[0])
        == b"/v2/templates/my-team%2Fmy-template/builds/build-id"
    )


async def test_async_build_status_sends_encoded_template_id():
    client, requests = _recording_client()

    with pytest.raises(BuildException):
        await async_build_api.get_build_status(client, NAMESPACED, "build-id", 0)

    assert (
        _request_path(requests[0])
        == b"/templates/my-team%2Fmy-template/builds/build-id/status"
    )


def test_sync_delete_snapshot_sends_encoded_snapshot_id(monkeypatch):
    client, requests = _recording_client()
    monkeypatch.setattr(
        "e2b.sandbox_sync.sandbox_api.get_api_client", lambda config: client
    )

    assert SyncSandboxApi._cls_delete_snapshot(NAMESPACED_SNAPSHOT, api_key="e2b_test")

    # Snapshot IDs carry both a namespace slash and a `:tag`; both must stay
    # encoded so DELETE /templates/{id} targets one path segment.
    assert _request_path(requests[0]) == b"/templates/team-slug%2Fmy-snapshot%3Adefault"


async def test_async_delete_snapshot_sends_encoded_snapshot_id(monkeypatch):
    client, requests = _recording_client()
    monkeypatch.setattr(
        "e2b.sandbox_async.sandbox_api.get_api_client", lambda config: client
    )

    assert await AsyncSandboxApi._cls_delete_snapshot(
        NAMESPACED_SNAPSHOT, api_key="e2b_test"
    )

    assert _request_path(requests[0]) == b"/templates/team-slug%2Fmy-snapshot%3Adefault"


# The tests above stop at the httpx layer, where the SDK builds the request.
# In production the request is then handed to pyqwest, which rebuilds the URL
# in reqwest — so these drive the public API through the real transport stack
# against a local server and assert the request target that actually goes out
# on the wire.


@pytest.fixture
def path_recording_server():
    """Local HTTP server yielding its base URL and the raw request targets it saw."""
    paths: List[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            # `self.path` is the request target verbatim — the stdlib server
            # does not percent-decode it.
            paths.append(self.path)
            body = b'{"code":404,"message":"not found"}'
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_DELETE(self):
            paths.append(self.path)
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}", paths
    finally:
        server.shutdown()
        thread.join()


def test_sync_exists_keeps_alias_encoded_on_the_wire(
    path_recording_server, test_api_key
):
    api_url, paths = path_recording_server

    assert Template.exists(NAMESPACED, api_key=test_api_key, api_url=api_url) is False

    assert paths == ["/templates/aliases/my-team%2Fmy-template"]


async def test_async_exists_keeps_alias_encoded_on_the_wire(
    path_recording_server, test_api_key
):
    api_url, paths = path_recording_server

    assert (
        await AsyncTemplate.exists(NAMESPACED, api_key=test_api_key, api_url=api_url)
        is False
    )

    assert paths == ["/templates/aliases/my-team%2Fmy-template"]


def test_sync_delete_snapshot_keeps_snapshot_id_encoded_on_the_wire(
    path_recording_server, test_api_key
):
    api_url, paths = path_recording_server

    assert Sandbox.delete_snapshot(
        NAMESPACED_SNAPSHOT, api_key=test_api_key, api_url=api_url
    )

    assert paths == ["/templates/team-slug%2Fmy-snapshot%3Adefault"]


async def test_async_delete_snapshot_keeps_snapshot_id_encoded_on_the_wire(
    path_recording_server, test_api_key
):
    api_url, paths = path_recording_server

    assert await AsyncSandbox.delete_snapshot(
        NAMESPACED_SNAPSHOT, api_key=test_api_key, api_url=api_url
    )

    assert paths == ["/templates/team-slug%2Fmy-snapshot%3Adefault"]
