import socket
import threading
from dataclasses import dataclass

import httpx
import pytest
from pyqwest import Headers

from e2b.envd.pyqwest_httpx_adapter import AsyncPyqwestHTTPXAdapter, PyqwestHTTPXAdapter
from e2b.envd.process import process_connect, process_pb2
from e2b.envd.rpc import (
    STREAM_REQUEST_TIMEOUT_HEADER,
    connect_client_kwargs,
    stream_request_headers,
    stream_timeout_ms,
)


class AsyncBytes(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = chunks

    async def __aiter__(self):
        for chunk in self._chunks:
            yield chunk


@dataclass
class ProxyRequest:
    method: str
    target: str
    body: bytes


class RecordingProxy:
    def __init__(self) -> None:
        self.requests: list[ProxyRequest] = []
        self._ready = threading.Event()
        self._closed = threading.Event()
        self._thread = threading.Thread(target=self._serve, daemon=True)

    @property
    def url(self) -> str:
        self._ready.wait(timeout=5)
        return f"http://{self.host}:{self.port}"

    def __enter__(self):
        self._thread.start()
        self._ready.wait(timeout=5)
        return self

    def __exit__(self, exc_type, exc, tb):
        self._closed.set()
        try:
            with socket.create_connection((self.host, self.port), timeout=1):
                pass
        except OSError:
            pass
        self._thread.join(timeout=5)

    def _serve(self) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", 0))
            server.listen()
            self.host, self.port = server.getsockname()
            self._ready.set()

            while not self._closed.is_set():
                conn, _ = server.accept()
                with conn:
                    data = self._read_request(conn)
                    if not data:
                        continue

                    request_head, body = data.split(b"\r\n\r\n", 1)
                    lines = request_head.decode().splitlines()
                    method, target, _ = lines[0].split(" ", 2)
                    content_length = self._content_length(lines[1:])

                    while len(body) < content_length:
                        body += conn.recv(65536)

                    self.requests.append(
                        ProxyRequest(method=method, target=target, body=body)
                    )
                    response = b'{"ok":true}'
                    conn.sendall(
                        b"HTTP/1.1 200 OK\r\n"
                        b"Content-Type: application/json\r\n"
                        + f"Content-Length: {len(response)}\r\n".encode()
                        + b"Connection: close\r\n\r\n"
                        + response
                    )

    def _read_request(self, conn: socket.socket) -> bytes:
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = conn.recv(65536)
            if not chunk:
                return data
            data += chunk
        return data

    def _content_length(self, header_lines: list[str]) -> int:
        for line in header_lines:
            name, _, value = line.partition(":")
            if name.lower() == "content-length":
                return int(value.strip())
        return 0


def test_sync_pyqwest_httpx_adapter_uses_httpx_transport():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            content=b'{"ok":true}',
        )

    client = PyqwestHTTPXAdapter(httpx.MockTransport(handler))

    response = client.post(
        "https://sandbox.test/process.Process/List",
        headers=Headers({"x-test": "1"}),
        content=b"payload",
        timeout=1,
    )

    assert response.status == 200
    assert response.content == b'{"ok":true}'
    assert requests[0].headers["x-test"] == "1"
    assert requests[0].content == b"payload"


def test_sync_pyqwest_httpx_adapter_retries_remote_protocol_errors():
    attempts: list[bytes] = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request.content)
        if len(attempts) <= 3:
            raise httpx.RemoteProtocolError("connection reset")

        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            content=b'{"ok":true}',
        )

    client = PyqwestHTTPXAdapter(httpx.MockTransport(handler))

    response = client.post(
        "https://sandbox.test/process.Process/List",
        content=b"payload",
    )

    assert response.status == 200
    assert attempts == [b"payload", b"payload", b"payload", b"payload"]


def test_sync_pyqwest_httpx_adapter_streams_response():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            content=[b"one", b"two"],
        )

    client = PyqwestHTTPXAdapter(httpx.MockTransport(handler))

    with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        headers=Headers({"x-test": "1"}),
        content=[b"payload"],
        timeout=1,
    ) as response:
        assert response.status == 200
        assert list(response.content) == [b"one", b"two"]


def test_sync_pyqwest_httpx_adapter_retries_remote_protocol_stream_open():
    attempts: list[bytes] = []

    def content():
        yield b"payload"

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request.content)
        if len(attempts) <= 3:
            raise httpx.RemoteProtocolError("connection reset")

        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            content=[b"one"],
        )

    client = PyqwestHTTPXAdapter(httpx.MockTransport(handler))

    with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        content=content(),
    ) as response:
        assert list(response.content) == [b"one"]

    assert attempts == [b"payload", b"payload", b"payload", b"payload"]


def test_sync_pyqwest_httpx_adapter_applies_stream_request_timeout():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            content=[b"one"],
        )

    client = PyqwestHTTPXAdapter(httpx.MockTransport(handler))

    with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        headers=Headers(
            {
                "x-test": "1",
                STREAM_REQUEST_TIMEOUT_HEADER: "5",
            }
        ),
        content=[b"payload"],
        timeout=60,
    ) as response:
        assert list(response.content) == [b"one"]

    assert STREAM_REQUEST_TIMEOUT_HEADER not in requests[0].headers
    assert requests[0].extensions["timeout"] == {
        "connect": 5.0,
        "read": 60,
        "write": 5.0,
        "pool": 5.0,
    }


def test_sync_pyqwest_httpx_adapter_ignores_unlimited_stream_request_timeout():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            content=[b"one"],
        )

    client = PyqwestHTTPXAdapter(httpx.MockTransport(handler))

    with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        headers=Headers({STREAM_REQUEST_TIMEOUT_HEADER: "0"}),
        content=[b"payload"],
        timeout=60,
    ) as response:
        assert list(response.content) == [b"one"]

    assert STREAM_REQUEST_TIMEOUT_HEADER not in requests[0].headers
    assert requests[0].extensions["timeout"] == {
        "connect": 60,
        "read": 60,
        "write": 60,
        "pool": 60,
    }


def test_sync_pyqwest_httpx_adapter_uses_configured_proxy():
    with RecordingProxy() as proxy:
        transport = httpx.HTTPTransport(proxy=proxy.url)
        client = PyqwestHTTPXAdapter(transport)

        response = client.post(
            "http://sandbox.test/process.Process/List",
            headers=Headers({"x-test": "1"}),
            content=b"payload",
            timeout=1,
        )

    assert response.status == 200
    assert proxy.requests == [
        ProxyRequest(
            method="POST",
            target="http://sandbox.test/process.Process/List",
            body=b"payload",
        )
    ]


def test_sync_generated_stream_request_shape():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            content=b"{}",
        )

    client = process_connect.ProcessClientSync(
        "https://sandbox.test",
        **connect_client_kwargs(
            {"x-sandbox": "1"},
            PyqwestHTTPXAdapter(httpx.MockTransport(handler)),
        ),
    )
    events = client.start(
        process_pb2.StartRequest(
            process=process_pb2.ProcessConfig(cmd="/bin/bash"),
        ),
        headers=stream_request_headers({"E2B-Keepalive-Ping": "15"}, 5),
        timeout_ms=stream_timeout_ms(60),
    )

    with pytest.raises(StopIteration):
        next(events)

    request = requests[0]
    assert request.method == "POST"
    assert str(request.url) == "https://sandbox.test/process.Process/Start"
    assert request.headers["x-sandbox"] == "1"
    assert request.headers["e2b-keepalive-ping"] == "15"
    assert request.headers["connect-timeout-ms"] == "60000"
    assert STREAM_REQUEST_TIMEOUT_HEADER not in request.headers
    assert request.extensions["timeout"]["connect"] == 5.0
    assert 0 < request.extensions["timeout"]["read"] <= 60
    assert request.extensions["timeout"]["write"] == 5.0
    assert request.extensions["timeout"]["pool"] == 5.0
    assert b'"cmd": "/bin/bash"' in request.content


@pytest.mark.asyncio
async def test_async_pyqwest_httpx_adapter_uses_httpx_transport():
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            stream=AsyncBytes([b'{"ok":true}']),
        )

    client = AsyncPyqwestHTTPXAdapter(httpx.MockTransport(handler))

    response = await client.post(
        "https://sandbox.test/process.Process/List",
        headers=Headers({"x-test": "1"}),
        content=b"payload",
    )

    assert response.status == 200
    assert response.content == b'{"ok":true}'
    assert requests[0].headers["x-test"] == "1"
    assert await requests[0].aread() == b"payload"


@pytest.mark.asyncio
async def test_async_pyqwest_httpx_adapter_retries_remote_protocol_errors():
    attempts: list[bytes] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(await request.aread())
        if len(attempts) <= 3:
            raise httpx.RemoteProtocolError("connection reset")

        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            stream=AsyncBytes([b'{"ok":true}']),
        )

    client = AsyncPyqwestHTTPXAdapter(httpx.MockTransport(handler))

    response = await client.post(
        "https://sandbox.test/process.Process/List",
        content=b"payload",
    )

    assert response.status == 200
    assert attempts == [b"payload", b"payload", b"payload", b"payload"]


@pytest.mark.asyncio
async def test_async_pyqwest_httpx_adapter_streams_response():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            stream=AsyncBytes([b"one", b"two"]),
        )

    async def content():
        yield b"payload"

    client = AsyncPyqwestHTTPXAdapter(httpx.MockTransport(handler))

    async with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        headers=Headers({"x-test": "1"}),
        content=content(),
    ) as response:
        chunks = []
        async for chunk in response.content:
            chunks.append(chunk)

        assert response.status == 200
        assert chunks == [b"one", b"two"]


@pytest.mark.asyncio
async def test_async_pyqwest_httpx_adapter_retries_remote_protocol_stream_open():
    attempts: list[bytes] = []

    async def content():
        yield b"payload"

    async def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(await request.aread())
        if len(attempts) <= 3:
            raise httpx.RemoteProtocolError("connection reset")

        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            stream=AsyncBytes([b"one"]),
        )

    client = AsyncPyqwestHTTPXAdapter(httpx.MockTransport(handler))

    async with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        content=content(),
    ) as response:
        chunks = []
        async for chunk in response.content:
            chunks.append(chunk)

    assert chunks == [b"one"]
    assert attempts == [b"payload", b"payload", b"payload", b"payload"]


@pytest.mark.asyncio
async def test_async_pyqwest_httpx_adapter_applies_stream_request_timeout():
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            stream=AsyncBytes([b"one"]),
        )

    async def content():
        yield b"payload"

    client = AsyncPyqwestHTTPXAdapter(httpx.MockTransport(handler))

    async with client.stream(
        "POST",
        "https://sandbox.test/process.Process/Start",
        headers=Headers(
            {
                "x-test": "1",
                STREAM_REQUEST_TIMEOUT_HEADER: "5",
            }
        ),
        content=content(),
        timeout=60,
    ) as response:
        chunks = []
        async for chunk in response.content:
            chunks.append(chunk)

    assert chunks == [b"one"]
    assert STREAM_REQUEST_TIMEOUT_HEADER not in requests[0].headers
    assert requests[0].extensions["timeout"] == {
        "connect": 5.0,
        "read": 60,
        "write": 5.0,
        "pool": 5.0,
    }


@pytest.mark.asyncio
async def test_async_pyqwest_httpx_adapter_uses_configured_proxy():
    with RecordingProxy() as proxy:
        transport = httpx.AsyncHTTPTransport(proxy=proxy.url)
        client = AsyncPyqwestHTTPXAdapter(transport)

        response = await client.post(
            "http://sandbox.test/process.Process/List",
            headers=Headers({"x-test": "1"}),
            content=b"payload",
        )

    assert response.status == 200
    assert proxy.requests == [
        ProxyRequest(
            method="POST",
            target="http://sandbox.test/process.Process/List",
            body=b"payload",
        )
    ]


@pytest.mark.asyncio
async def test_async_generated_unlimited_stream_request_shape():
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/connect+json"},
            content=b"{}",
        )

    client = process_connect.ProcessClient(
        "https://sandbox.test",
        **connect_client_kwargs(
            {"x-sandbox": "1"},
            AsyncPyqwestHTTPXAdapter(httpx.MockTransport(handler)),
        ),
    )
    events = client.start(
        process_pb2.StartRequest(
            process=process_pb2.ProcessConfig(cmd="/bin/bash"),
        ),
        headers=stream_request_headers({"E2B-Keepalive-Ping": "15"}, 5),
        timeout_ms=stream_timeout_ms(0),
    )

    with pytest.raises(StopAsyncIteration):
        await events.__anext__()

    request = requests[0]
    assert request.method == "POST"
    assert str(request.url) == "https://sandbox.test/process.Process/Start"
    assert request.headers["x-sandbox"] == "1"
    assert request.headers["e2b-keepalive-ping"] == "15"
    assert "connect-timeout-ms" not in request.headers
    assert STREAM_REQUEST_TIMEOUT_HEADER not in request.headers
    assert request.extensions["timeout"] == {
        "connect": 5.0,
        "read": None,
        "write": 5.0,
        "pool": 5.0,
    }
    assert b'"cmd": "/bin/bash"' in await request.aread()
