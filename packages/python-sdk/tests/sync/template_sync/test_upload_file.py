import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from e2b.api.client.client import AuthenticatedClient
from e2b.template_sync.build_api import upload_file


# Regression test for e2b-dev/e2b#1243 — upload_file must set Content-Length
# and must not fall back to Transfer-Encoding: chunked. S3 presigned PUT URLs
# reject chunked encoding with 501 NotImplemented. httpx sets Content-Length
# automatically when we pass bytes (tar_buffer.getvalue()); this test guards
# against someone swapping the bytes for a generator/stream later.


def _make_server():
    state = {"headers": None, "body_length": 0}

    class Handler(BaseHTTPRequestHandler):
        def do_PUT(self):
            state["headers"] = dict(self.headers)
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b""
            state["body_length"] = len(body)
            self.send_response(200)
            self.end_headers()

        def log_message(self, *args, **kwargs):
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, state


def test_upload_file_sets_content_length_and_no_chunked_encoding(tmp_path):
    (tmp_path / "hello.txt").write_text("hello world")

    server, thread, state = _make_server()
    host, port = server.server_address
    url = f"http://{host}:{port}/upload"

    try:
        client = AuthenticatedClient(base_url="http://test", token="test")
        upload_file(
            api_client=client,
            file_name="*.txt",
            context_path=str(tmp_path),
            url=url,
            ignore_patterns=[],
            resolve_symlinks=False,
            stack_trace=None,
        )
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    assert state["headers"] is not None
    content_length = state["headers"].get("Content-Length")
    assert content_length is not None
    assert int(content_length) > 0
    assert int(content_length) == state["body_length"]

    transfer_encoding = state["headers"].get("Transfer-Encoding")
    if transfer_encoding is not None:
        assert "chunked" not in transfer_encoding.lower()
