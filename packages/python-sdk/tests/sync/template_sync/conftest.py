import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Tuple

import pytest

_DIR = os.path.dirname(os.path.abspath(__file__))


def pytest_collection_modifyitems(items):
    for item in items:
        if str(item.fspath).startswith(_DIR):
            item.add_marker(pytest.mark.timeout(180))


class FakeApi:
    """A local stand-in for the E2B REST API.

    Routes map ``(method, path)`` to ``(status, json_body)``; an optional third
    element delays the response by that many seconds. Unrouted requests get a
    404. A path ending in ``*`` matches by prefix. Every request is recorded as ``(method, path, headers, json_body)``.
    """

    def __init__(self):
        self.routes: Dict[Tuple[str, str], tuple] = {}
        self.requests: List[Tuple[str, str, Dict[str, str], Any]] = []
        self.url = ""

    def route(self, method: str, path: str, status: int, body: Any = None, delay=0):
        self.routes[(method, path)] = (status, body, delay)

    def lookup(self, method: str, path: str) -> tuple:
        for (m, p), response in self.routes.items():
            if m == method and (
                p == path or (p.endswith("*") and path.startswith(p[:-1]))
            ):
                return response
        return (404, {"code": 404, "message": "not found"}, 0)

    def requests_to(self, method: str, path: str) -> List[Any]:
        return [b for m, p, _, b in self.requests if m == method and p == path]


@pytest.fixture
def fake_api():
    api = FakeApi()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _handle(self):
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b""
            try:
                body = json.loads(raw) if raw else None
            except ValueError:
                body = raw
            headers = {k.lower(): v for k, v in self.headers.items()}
            api.requests.append((self.command, self.path, headers, body))

            status, payload, delay = api.lookup(self.command, self.path)
            if delay:
                time.sleep(delay)
            data = json.dumps(payload).encode() if payload is not None else b""
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_POST = do_PUT = do_DELETE = _handle

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True
    )
    thread.start()
    api.url = f"http://127.0.0.1:{server.server_port}"
    try:
        yield api
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
