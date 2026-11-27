"""A local HTTP server that stands in for the E2B API and for envd.

Tests point the SDK at it with the public ``api_url`` and ``sandbox_url``
options, so a test calls the SDK the way a user does and reads what was sent
on the wire: the request path, headers and body. Nothing inside the SDK is
replaced.
"""

import json
import threading

from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Dict, List, Optional, Tuple

Reply = Tuple[int, Optional[Any]]


@dataclass
class RecordedRequest:
    method: str
    path: str
    """The request target as it was sent, percent-encoding and query included."""
    headers: Dict[str, str]
    """Header names in lower case."""
    body: bytes

    def json(self) -> Any:
        return json.loads(self.body)

    def __str__(self) -> str:
        return f"{self.method} {self.path}"


def _created_sandbox() -> Reply:
    return 201, {
        "sandboxID": "sbx-test",
        "templateID": "template-id",
        "clientID": "client-id",
        "envdVersion": "0.6.11",
        "envdAccessToken": "test-envd-access-token",
    }


def _envd_not_found() -> Reply:
    # A Connect error envd could give; the SDK reports it as not found.
    return 404, {"code": "not_found", "message": "answered by the test"}


@dataclass
class RecordingBackend:
    url: str = ""
    requests: List[RecordedRequest] = field(default_factory=list)
    delay: float = 0
    """Seconds every reply is held back."""
    _routes: List[Tuple[str, str, Callable[[], Reply]]] = field(default_factory=list)

    def reply(self, method: str, path_prefix: str, status: int, body: Any = None):
        """Answer requests for ``method`` whose path starts with ``path_prefix``."""
        self._routes.insert(0, (method, path_prefix, lambda: (status, body)))

    @property
    def sent(self) -> List[str]:
        """Every request as ``METHOD /path``."""
        return [str(request) for request in self.requests]

    def _answer(self, method: str, path: str) -> Reply:
        for route_method, prefix, reply in self._routes:
            if route_method == method and path.startswith(prefix):
                return reply()
        if method == "POST" and path == "/v2/sandboxes":
            return _created_sandbox()
        if method == "GET" and path.startswith("/v2/sandboxes"):
            return 200, []
        if path.startswith(("/process.Process/", "/filesystem.Filesystem/")):
            return _envd_not_found()
        return 204, None


def start_recording_backend() -> Tuple[RecordingBackend, Callable[[], None]]:
    backend = RecordingBackend()

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def _handle(self):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b""
            backend.requests.append(
                RecordedRequest(
                    method=self.command,
                    path=self.path,
                    headers={k.lower(): v for k, v in self.headers.items()},
                    body=body,
                )
            )
            if backend.delay:
                threading.Event().wait(backend.delay)

            status, payload = backend._answer(self.command, self.path)
            out = b"" if payload is None else json.dumps(payload).encode()
            self.send_response(status)
            if payload is not None:
                self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)

        do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = _handle

        def log_message(self, *args, **kwargs):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    # A short poll keeps `shutdown()` from holding every test for half a second.
    thread = threading.Thread(
        target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True
    )
    thread.start()
    backend.url = f"http://127.0.0.1:{server.server_port}"

    def stop():
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    return backend, stop
