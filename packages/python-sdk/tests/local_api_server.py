"""Local HTTP server standing in for the E2B API in offline tests.

Records every request (method, path with query, lowercased headers) and answers
with whatever the test's ``respond(method, path)`` returns, so tests drive the
public SDK classes with ``api_url=server.url`` and assert at the HTTP boundary.
Not a test module itself — imported by test modules (``pythonpath = tests`` in
pytest.ini makes it importable under ``--import-mode=importlib``).
"""

import contextlib
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Dict, Iterator, List, NamedTuple, Optional, Tuple

API_KEY = "e2b_" + "0" * 40

SANDBOX_RESPONSE = {
    "templateID": "base",
    "sandboxID": "sbx-test",
    "clientID": "client-test",
    "envdVersion": "0.2.0",
}

# (status, JSON body, extra response headers)
Reply = Tuple[int, Any, Optional[Dict[str, str]]]


class RecordedRequest(NamedTuple):
    method: str
    path: str
    headers: Dict[str, str]


class LocalApiServer:
    def __init__(self, url: str, requests: List[RecordedRequest]):
        self.url = url
        self.requests = requests


@contextlib.contextmanager
def local_api_server(
    respond: Callable[[str, str], Reply],
) -> Iterator[LocalApiServer]:
    requests: List[RecordedRequest] = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # silence the default stderr log
            pass

        def _handle(self):
            length = int(self.headers.get("Content-Length") or 0)
            if length:
                self.rfile.read(length)
            requests.append(
                RecordedRequest(
                    self.command,
                    self.path,
                    {k.lower(): v for k, v in self.headers.items()},
                )
            )
            status, body, headers = respond(self.command, self.path)
            payload = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.write(payload)

        do_GET = do_POST = do_DELETE = _handle

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield LocalApiServer(f"http://127.0.0.1:{server.server_port}", requests)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def create_sandbox_reply(method: str, path: str) -> Reply:
    if method == "POST" and path.startswith("/v2/sandboxes"):
        return 201, SANDBOX_RESPONSE, None
    return 404, {"code": 404, "message": "not found"}, None
