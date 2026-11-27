import inspect
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any, Dict, Tuple
from urllib.parse import urlsplit

import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.exceptions import (
    SandboxException,
    SandboxNotFoundException,
    TemplateException,
)

ERRORS: Dict[str, Tuple[int, Dict[str, Any]]] = {
    "missing": (404, {"code": 404, "message": "Sandbox doesn't exist"}),
    "wrong-route": (
        404,
        {"code": 404, "message": "validation error: no matching operation was found"},
    ),
    "gateway-not-found": (404, {"code": 5, "message": "Not Found"}),
    "http-500-with-404-code": (
        500,
        {"code": 404, "message": "downstream sandbox not found"},
    ),
}


def _extract_resource_id(path: str) -> str:
    parts = [part for part in urlsplit(path).path.split("/") if part]
    for resource in ("sandboxes", "templates"):
        if resource in parts:
            return parts[parts.index(resource) + 1]
    raise ValueError(f"Unexpected path: {path}")


class _Api(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _respond(self):
        sandbox_id = _extract_resource_id(self.path)
        status, body = ERRORS.get(
            sandbox_id, (500, {"code": 500, "message": "Unexpected sandbox_id in test"})
        )
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    do_GET = _respond
    do_POST = _respond
    do_PUT = _respond
    do_DELETE = _respond


@pytest.fixture(scope="module")
def api():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Api)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield {
            "api_url": f"http://127.0.0.1:{server.server_port}",
            "api_key": "e2b_test_key",
        }
    finally:
        server.shutdown()
        server.server_close()


async def _await_if_needed(value):
    return await value if inspect.isawaitable(value) else value


THROWING_METHODS = [
    pytest.param(lambda cls, sid, kw: cls.get_info(sid, **kw), id="get_info"),
    pytest.param(lambda cls, sid, kw: cls.get_metrics(sid, **kw), id="get_metrics"),
    pytest.param(lambda cls, sid, kw: cls.set_timeout(sid, 60, **kw), id="set_timeout"),
    pytest.param(
        lambda cls, sid, kw: cls.update_network(sid, {"allow_out": []}, **kw),
        id="update_network",
    ),
    pytest.param(lambda cls, sid, kw: cls.pause(sid, **kw), id="pause"),
    pytest.param(lambda cls, sid, kw: cls.beta_pause(sid, **kw), id="beta_pause"),
    pytest.param(
        lambda cls, sid, kw: cls.create_snapshot(sid, **kw), id="create_snapshot"
    ),
    pytest.param(lambda cls, sid, kw: cls.fork(sid, **kw), id="fork"),
    pytest.param(lambda cls, sid, kw: cls.connect(sid, **kw), id="connect"),
]

SANDBOX_CLASSES = [
    pytest.param(Sandbox, id="sync"),
    pytest.param(AsyncSandbox, id="async"),
]


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
@pytest.mark.parametrize("call", THROWING_METHODS)
async def test_raises_sandbox_not_found_when_missing(sandbox_cls, api, call):
    with pytest.raises(SandboxNotFoundException):
        await _await_if_needed(call(sandbox_cls, "missing", api))


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
@pytest.mark.parametrize("call", THROWING_METHODS)
@pytest.mark.parametrize(
    "sandbox_id, status_code, message",
    [
        (
            "wrong-route",
            404,
            "404: validation error: no matching operation was found",
        ),
        ("gateway-not-found", 404, "404: Not Found"),
        ("http-500-with-404-code", 500, "500: downstream sandbox not found"),
    ],
)
async def test_raises_generic_sandbox_exception_for_other_404s(
    sandbox_cls, api, call, sandbox_id, status_code, message
):
    with pytest.raises(SandboxException) as error:
        await _await_if_needed(call(sandbox_cls, sandbox_id, api))

    assert not isinstance(error.value, SandboxNotFoundException)
    assert error.value.status_code == status_code
    assert str(error.value) == message


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
async def test_kill_returns_false_when_missing(sandbox_cls, api):
    assert await _await_if_needed(sandbox_cls.kill("missing", **api)) is False


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
@pytest.mark.parametrize(
    "sandbox_id, status_code, message",
    [
        (
            "wrong-route",
            404,
            "404: validation error: no matching operation was found",
        ),
        ("gateway-not-found", 404, "404: Not Found"),
        ("http-500-with-404-code", 500, "500: downstream sandbox not found"),
    ],
)
async def test_kill_raises_generic_sandbox_exception_for_other_404s(
    sandbox_cls, api, sandbox_id, status_code, message
):
    with pytest.raises(SandboxException) as error:
        await _await_if_needed(sandbox_cls.kill(sandbox_id, **api))

    assert not isinstance(error.value, SandboxNotFoundException)
    assert error.value.status_code == status_code
    assert str(error.value) == message


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
async def test_delete_snapshot_returns_false_when_missing(sandbox_cls, api):
    assert (
        await _await_if_needed(sandbox_cls.delete_snapshot("missing", **api)) is False
    )


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
@pytest.mark.parametrize(
    "snapshot_id, status_code, message",
    [
        (
            "wrong-route",
            404,
            "404: validation error: no matching operation was found",
        ),
        ("gateway-not-found", 404, "404: Not Found"),
        ("http-500-with-404-code", 500, "500: downstream sandbox not found"),
    ],
)
async def test_delete_snapshot_raises_template_exception_for_other_404s(
    sandbox_cls, api, snapshot_id, status_code, message
):
    with pytest.raises(TemplateException) as error:
        await _await_if_needed(sandbox_cls.delete_snapshot(snapshot_id, **api))

    assert error.value.status_code == status_code
    assert str(error.value) == message
