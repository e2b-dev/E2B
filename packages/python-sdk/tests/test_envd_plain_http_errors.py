"""Plain (non-Connect-encoded) HTTP error responses — e.g. an edge proxy
answering for envd — must surface with the vendored client's status mapping
(#806) and the response body as the message. ``PlainHTTPErrorTransport``
raises them as ``ConnectError`` below connectrpc, before connectrpc would
collapse them into Connect-spec codes with synthesized reason phrases
(404 → UNIMPLEMENTED "Not Found"); connectrpc re-raises transport
``ConnectError`` unchanged, which the end-to-end tests pin through the real
generated stubs.
"""

import httpx
import pytest
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from envd_frame_server import (
    frame_recording_server,
    make_async_client,
    make_sync_client,
    make_config,
)
from packaging.version import Version
from pyqwest import (
    Headers,
    HTTPTransport,
    HTTPVersion,
    Request,
    Response,
    SyncHTTPTransport,
    SyncRequest,
    SyncResponse,
)

import e2b.sandbox_async.commands.command as command_async
from e2b.envd.client_async import (
    ConnectionRetryTransport,
    PlainHTTPErrorTransport,
)
from e2b.envd.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
    PlainHTTPErrorTransport as SyncPlainHTTPErrorTransport,
)
from e2b.envd.process.process_pb import ConnectRequest
from e2b.sandbox_async.commands.command import Commands


class RespondingTransport:
    """Inner async transport answering every request with a fixed response."""

    def __init__(self, status: int, content_type: str, body: bytes):
        self.status = status
        self.content_type = content_type
        self.body = body

    async def execute(self, request) -> Response:
        return Response(
            status=self.status,
            headers=Headers({"content-type": self.content_type}),
            content=self.body,
        )


class RespondingSyncTransport:
    def __init__(self, status: int, content_type: str, body: bytes):
        self.status = status
        self.content_type = content_type
        self.body = body

    def execute_sync(self, request) -> SyncResponse:
        return SyncResponse(
            status=self.status,
            headers=Headers({"content-type": self.content_type}),
            content=self.body,
        )


def _sync_request() -> SyncRequest:
    return SyncRequest("POST", "http://sandbox.test/rpc")


async def _executed(status: int, content_type: str, body: bytes):
    transport = PlainHTTPErrorTransport(RespondingTransport(status, content_type, body))
    return await transport.execute(Request("POST", "http://sandbox.test/rpc"))


async def _raised(status: int, content_type: str, body: bytes) -> ConnectError:
    with pytest.raises(ConnectError) as excinfo:
        await _executed(status, content_type, body)
    return excinfo.value


async def test_async_maps_plain_statuses_to_vendored_codes():
    assert (await _raised(404, "text/plain", b"x")).code is Code.NOT_FOUND
    assert (await _raised(409, "text/plain", b"x")).code is Code.ALREADY_EXISTS
    assert (await _raised(429, "text/plain", b"x")).code is Code.RESOURCE_EXHAUSTED
    assert (await _raised(502, "text/html", b"x")).code is Code.UNAVAILABLE
    # Statuses outside the vendored table stay unknown, as before.
    assert (await _raised(418, "text/plain", b"x")).code is Code.UNKNOWN


async def test_async_uses_body_as_message():
    error = await _raised(404, "text/plain", b"sandbox not found")
    assert error.message == "sandbox not found"


async def test_async_empty_body_falls_back_to_status():
    error = await _raised(404, "text/plain", b"")
    assert error.message == "HTTP 404"


async def test_async_leaves_connect_encoded_errors_to_connectrpc():
    # A valid Connect error (JSON body with a string `code`) is left to
    # connectrpc, rebuilt with the validity-checked body restored.
    for content_type in ("application/json", "application/json; charset=utf-8"):
        response = await _executed(404, content_type, b'{"code": "not_found"}')
        assert response.status == 404
        body = bytearray()
        async for chunk in response.content:
            body.extend(chunk)
        assert bytes(body) == b'{"code": "not_found"}'


async def test_async_maps_json_errors_without_a_valid_connect_code():
    # A gateway answering with a JSON body that is not Connect-encoded (#806):
    # an int `code` is treated as the HTTP status, like the vendored client.
    error = await _raised(
        429, "application/json", b'{"code": 429, "message": "rate limited"}'
    )
    assert error.code is Code.RESOURCE_EXHAUSTED
    assert error.message == "rate limited"

    # No `code` at all falls back to the response status, body as message.
    error = await _raised(404, "application/json", b'{"error": "no such route"}')
    assert error.code is Code.NOT_FOUND
    assert error.message == '{"error": "no such route"}'

    # Unparseable JSON falls back to the response status too.
    error = await _raised(502, "application/json", b"<html>bad gateway</html>")
    assert error.code is Code.UNAVAILABLE

    # An invalid code string is not a Connect error either.
    error = await _raised(429, "application/json", b'{"code": "TOO_MANY"}')
    assert error.code is Code.RESOURCE_EXHAUSTED


async def test_async_leaves_successful_responses_untouched():
    response = await _executed(200, "application/json", b"{}")
    assert response.status == 200


def test_sync_maps_plain_statuses_to_vendored_codes():
    transport = SyncPlainHTTPErrorTransport(
        RespondingSyncTransport(404, "text/plain", b"sandbox not found")
    )
    with pytest.raises(ConnectError) as excinfo:
        transport.execute_sync(_sync_request())
    assert excinfo.value.code is Code.NOT_FOUND
    assert excinfo.value.message == "sandbox not found"


def test_sync_leaves_connect_encoded_errors_to_connectrpc():
    transport = SyncPlainHTTPErrorTransport(
        RespondingSyncTransport(404, "application/json", b'{"code": "not_found"}')
    )
    response = transport.execute_sync(_sync_request())
    assert response.status == 404
    assert b"".join(response.content) == b'{"code": "not_found"}'


def test_sync_maps_json_errors_without_a_valid_connect_code():
    transport = SyncPlainHTTPErrorTransport(
        RespondingSyncTransport(
            429, "application/json", b'{"code": 429, "message": "rate limited"}'
        )
    )
    with pytest.raises(ConnectError) as excinfo:
        transport.execute_sync(_sync_request())
    assert excinfo.value.code is Code.RESOURCE_EXHAUSTED
    assert excinfo.value.message == "rate limited"


# End-to-end through the generated stubs against a real HTTP/2 server
# answering with a plain 404: pins that connectrpc re-raises the transport's
# ConnectError unchanged (`except ConnectError: raise`) on both the unary
# and the server-stream paths.

_PLAIN_404 = (404, "text/plain", b"sandbox not found")


def _stack(transport) -> PlainHTTPErrorTransport:
    # The factories' transport stack, minus TLS (the test server is
    # plaintext, so HTTP/2 by prior knowledge instead of ALPN).
    return PlainHTTPErrorTransport(ConnectionRetryTransport(transport))


async def test_async_kill_returns_false_on_plain_http_404(monkeypatch):
    with frame_recording_server(server_ends_stream=False, plain_error=_PLAIN_404) as (
        server
    ):
        base_url = f"http://127.0.0.1:{server.port}"
        rpc = make_async_client(
            server.port,
            transport=_stack(HTTPTransport(http_version=HTTPVersion.HTTP2)),
        )
        # Hand Commands the plaintext test client; the real factory would
        # also register a pooled TLS transport in the process-global cache.
        monkeypatch.setattr(
            command_async, "create_rpc_client", lambda *_args, **_kwargs: rpc
        )
        commands = Commands(
            base_url, make_config(), Version("0.5.0"), httpx.AsyncClient()
        )
        assert await commands.kill(pid=1) is False


def test_sync_stream_surfaces_plain_http_404_with_vendored_code():
    with frame_recording_server(server_ends_stream=False, plain_error=_PLAIN_404) as (
        server
    ):
        sync_stack = SyncPlainHTTPErrorTransport(
            SyncConnectionRetryTransport(
                SyncHTTPTransport(http_version=HTTPVersion.HTTP2)
            )
        )
        client = make_sync_client(server.port, transport=sync_stack)
        with pytest.raises(ConnectError) as excinfo:
            next(iter(client.connect(ConnectRequest())))
        assert excinfo.value.code is Code.NOT_FOUND
        assert excinfo.value.message == "sandbox not found"
