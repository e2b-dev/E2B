import inspect
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Any, Dict, Tuple
from urllib.parse import urlsplit

import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.api import handle_api_exception
from e2b.exceptions import (
    SandboxException,
    SandboxNotFoundException,
    TemplateException,
)

ERRORS: Dict[str, Tuple[int, bytes, str]] = {
    "missing": (
        404,
        json.dumps({"code": 404, "message": "Sandbox doesn't exist"}).encode(),
        "application/json",
    ),
    "empty-404": (404, b"", "text/plain"),
    "json-string-404": (404, json.dumps("Not Found").encode(), "application/json"),
    "wrong-route": (
        404,
        json.dumps(
            {
                "code": 404,
                "message": "validation error: no matching operation was found",
            }
        ).encode(),
        "application/json",
    ),
    "http-500-with-404-code": (
        500,
        json.dumps({"code": 404, "message": "downstream sandbox not found"}).encode(),
        "application/json",
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
        resource_id = _extract_resource_id(self.path)
        status, encoded, content_type = ERRORS.get(
            resource_id,
            (
                500,
                json.dumps(
                    {"code": 500, "message": "Unexpected resource_id in test"}
                ).encode(),
                "application/json",
            ),
        )
        self.send_response(status)
        self.send_header("Content-Type", content_type)
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


async def _await_if_needed(value: Any) -> Any:
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
        ("http-500-with-404-code", 500, "500: downstream sandbox not found"),
    ],
)
async def test_raises_generic_sandbox_exception_for_wrong_route(
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
        ("http-500-with-404-code", 500, "500: downstream sandbox not found"),
    ],
)
async def test_kill_raises_generic_sandbox_exception_for_wrong_route(
    sandbox_cls, api, sandbox_id, status_code, message
):
    with pytest.raises(SandboxException) as error:
        await _await_if_needed(sandbox_cls.kill(sandbox_id, **api))

    assert not isinstance(error.value, SandboxNotFoundException)
    assert error.value.status_code == status_code
    assert str(error.value) == message


@pytest.mark.parametrize("sandbox_cls", SANDBOX_CLASSES)
@pytest.mark.parametrize("snapshot_id", ["missing", "empty-404", "json-string-404"])
async def test_delete_snapshot_returns_false_on_not_found(
    sandbox_cls, api, snapshot_id
):
    assert (
        await _await_if_needed(sandbox_cls.delete_snapshot(snapshot_id, **api)) is False
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
        ("http-500-with-404-code", 500, "500: downstream sandbox not found"),
    ],
)
async def test_delete_snapshot_raises_template_exception_for_wrong_route(
    sandbox_cls, api, snapshot_id, status_code, message
):
    with pytest.raises(TemplateException) as error:
        await _await_if_needed(sandbox_cls.delete_snapshot(snapshot_id, **api))

    assert error.value.status_code == status_code
    assert str(error.value) == message


@pytest.mark.parametrize("content", [b'"Not Found"', b"null", b"[]"])
def test_handle_api_exception_handles_non_dict_json_body(content):
    class _Response:
        status_code = 404

        def __init__(self, raw: bytes):
            self.content = raw

    err = handle_api_exception(_Response(content), TemplateException)
    assert isinstance(err, TemplateException)
    assert err.status_code == 404
    assert str(err) == f"404: {content}"
