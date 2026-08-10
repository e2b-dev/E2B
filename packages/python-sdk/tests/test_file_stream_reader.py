"""Unit tests for the streamed-read helpers.

These exercise the readers' own lifecycle (consume / context manager /
explicit close / idle timeout) against a local chunked HTTP server. They
assert on the reader's contract — the underlying response is closed — rather
than on connection-pool internals, which are private to the transport and
absent on the pyqwest transports the SDK ships.
"""

import socket
import threading
import time

import httpx
import pytest

from e2b.sandbox.filesystem.filesystem import (
    AsyncFileStreamReader,
    FileStreamReader,
)

CHUNKS = [f"chunk{i}".encode() for i in range(5)]
EXPECTED = b"".join(CHUNKS)


def _start_chunked_server(
    stall_before: int = -1,
    stall_seconds: float = 0.0,
) -> int:
    """Start a one-shot HTTP server that replies with a chunked body.

    When ``stall_before`` is set, the server sleeps ``stall_seconds`` before
    sending that chunk index, so a reader with a shorter idle timeout times out.
    Returns the server's port.
    """
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(1)
    port = sock.getsockname()[1]

    def serve():
        try:
            conn, _ = sock.accept()
            while b"\r\n\r\n" not in conn.recv(65536):
                pass
            conn.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/octet-stream\r\n"
                b"Transfer-Encoding: chunked\r\n\r\n"
            )
            for idx, chunk in enumerate(CHUNKS):
                if idx == stall_before:
                    time.sleep(stall_seconds)
                conn.sendall(f"{len(chunk):x}\r\n".encode() + chunk + b"\r\n")
            conn.sendall(b"0\r\n\r\n")
            conn.close()
        except OSError:
            pass
        finally:
            sock.close()

    threading.Thread(target=serve, daemon=True).start()
    return port


def _open_stream(client, port):
    request = client.build_request(
        "GET", f"http://127.0.0.1:{port}/files", timeout=httpx.Timeout(5.0)
    )
    return client.send(request, stream=True)


def test_sync_full_consume_releases_connection():
    with httpx.Client() as client:
        port = _start_chunked_server()
        response = _open_stream(client, port)
        reader = FileStreamReader(response)
        assert b"".join(reader) == EXPECTED
        assert response.is_closed


def test_sync_context_manager_releases_on_exit():
    with httpx.Client() as client:
        port = _start_chunked_server()
        response = _open_stream(client, port)
        with FileStreamReader(response) as reader:
            assert next(iter(reader)) == CHUNKS[0]
            assert not response.is_closed
        # Exiting the context releases the response even though the stream
        # was only partially consumed.
        assert response.is_closed


def test_sync_close_is_idempotent():
    with httpx.Client() as client:
        port = _start_chunked_server()
        response = _open_stream(client, port)
        reader = FileStreamReader(response)
        reader.close()
        reader.close()
        assert response.is_closed


async def test_async_full_consume_releases_connection():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        response = await client.send(request, stream=True)
        reader = AsyncFileStreamReader(response)
        collected = b"".join([chunk async for chunk in reader])
        assert collected == EXPECTED
        assert response.is_closed


async def test_async_context_manager_releases_on_exit():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        response = await client.send(request, stream=True)
        async with AsyncFileStreamReader(response) as reader:
            assert await reader.__anext__() == CHUNKS[0]
            assert not response.is_closed
        assert response.is_closed


async def test_async_aclose_is_idempotent():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        response = await client.send(request, stream=True)
        reader = AsyncFileStreamReader(response)
        await reader.aclose()
        await reader.aclose()
        assert response.is_closed


async def test_async_reader_explicit_idle_timeout_bounds_each_read():
    # The per-call idle bound is enforced with wait_for around each read, so
    # it works on the regular transport (no transport-level read timeout).
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server(stall_before=1, stall_seconds=0.5)
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        response = await client.send(request, stream=True)
        reader = AsyncFileStreamReader(response, idle_timeout=0.05)
        assert await reader.__anext__() == CHUNKS[0]
        with pytest.raises(httpx.ReadTimeout):
            await reader.__anext__()
        assert response.is_closed


async def test_async_reader_explicit_idle_timeout_allows_prompt_chunks():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        response = await client.send(request, stream=True)
        reader = AsyncFileStreamReader(response, idle_timeout=5.0)
        collected = b"".join([chunk async for chunk in reader])
        assert collected == EXPECTED
        assert response.is_closed


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
