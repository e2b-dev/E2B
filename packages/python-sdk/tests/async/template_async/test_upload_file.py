import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest import mock

import httpx

from e2b.api.client.client import AuthenticatedClient
from e2b.template import utils as template_utils
from e2b.template.consts import FILE_UPLOAD_TIMEOUT_SECONDS
from e2b.template_async.build_api import upload_file


# Regression test for e2b-dev/e2b#1243 — upload_file must set Content-Length
# and must not fall back to Transfer-Encoding: chunked. S3 presigned PUT URLs
# reject chunked encoding with 501 NotImplemented. The archive is streamed
# from a temporary file on disk with a known Content-Length instead of being
# buffered in memory; this test guards that contract.
#
# The mock server runs in a daemon thread and doesn't need to be async — the
# httpx.AsyncClient connects to it via asyncio sockets without blocking the
# event loop.


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


async def test_upload_file_sets_content_length_and_no_chunked_encoding(tmp_path):
    (tmp_path / "hello.txt").write_text("hello world")

    server, thread, state = _make_server()
    host, port = server.server_address
    url = f"http://{host}:{port}/upload"

    try:

        class UploadClient(AuthenticatedClient):
            def get_async_httpx_client(self):
                raise AssertionError("signed uploads should not use the API client")

        client = UploadClient(base_url="http://test", token="test")
        await upload_file(
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
    assert "Authorization" not in state["headers"]


async def _capture_upload_timeout(tmp_path, request_timeout=None):
    """Run upload_file against a local server, capturing the httpx timeout."""
    (tmp_path / "hello.txt").write_text("hello world")

    server, thread, state = _make_server()
    host, port = server.server_address
    url = f"http://{host}:{port}/upload"

    captured = {}
    real_client = httpx.AsyncClient

    def spy_client(*args, **kwargs):
        captured["timeout"] = kwargs.get("timeout")
        return real_client(*args, **kwargs)

    try:
        client = AuthenticatedClient(base_url="http://test", token="test")
        kwargs = {}
        if request_timeout is not None:
            kwargs["request_timeout"] = request_timeout
        with mock.patch(
            "e2b.template_async.build_api.httpx.AsyncClient", side_effect=spy_client
        ):
            await upload_file(
                api_client=client,
                file_name="*.txt",
                context_path=str(tmp_path),
                url=url,
                ignore_patterns=[],
                resolve_symlinks=False,
                stack_trace=None,
                **kwargs,
            )
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    return captured["timeout"]


async def test_upload_file_defaults_to_one_hour_timeout(tmp_path):
    # Uploads of large archives need far longer than the 60s general API
    # timeout, so the default upload timeout is 1 hour (matches the JS SDK).
    timeout = await _capture_upload_timeout(tmp_path)
    assert timeout == httpx.Timeout(FILE_UPLOAD_TIMEOUT_SECONDS)


async def test_upload_file_honors_explicit_request_timeout(tmp_path):
    # An explicitly set request_timeout overrides the 1-hour upload default.
    timeout = await _capture_upload_timeout(tmp_path, request_timeout=5.0)
    assert timeout == httpx.Timeout(5.0)


async def test_upload_file_ignores_post_upload_close_failure(tmp_path):
    # Regression test: once S3 has accepted the archive, closing the spooled
    # temp file in the `finally` block can raise. That failure must not be
    # wrapped as a FileUploadException — the upload already succeeded.
    (tmp_path / "hello.txt").write_text("hello world")

    server, thread, state = _make_server()
    host, port = server.server_address
    url = f"http://{host}:{port}/upload"

    real_tar_file_stream = template_utils.tar_file_stream

    class _FailingCloseFile:
        # Proxies a real spooled temp file but raises on close(). The
        # underlying file object is a C type whose `close` attribute can't
        # be reassigned, so we wrap it instead.
        def __init__(self, inner):
            self._inner = inner

        def __getattr__(self, name):
            return getattr(self._inner, name)

        def __iter__(self):
            return iter(self._inner)

        def close(self):
            # Run the real close so we don't leak the temp file, then
            # simulate a close failure surfacing from the `finally`.
            self._inner.close()
            raise OSError("close failed")

    def failing_close_stream(*args, **kwargs):
        return _FailingCloseFile(real_tar_file_stream(*args, **kwargs))

    try:
        client = AuthenticatedClient(base_url="http://test", token="test")
        with mock.patch(
            "e2b.template_async.build_api.tar_file_stream",
            side_effect=failing_close_stream,
        ):
            # Must not raise despite close() failing after a 200 response.
            await upload_file(
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
