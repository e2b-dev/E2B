"""Unit tests for the streamed-read helpers.

These exercise connection lifecycle (consume / context manager / explicit
close / garbage collection) without hitting a real sandbox, using a local
chunked HTTP server.
"""

import gc
import socket
import threading

import httpx
import pytest

from e2b.sandbox.filesystem.filesystem import (
    AsyncFileStreamReader,
    FileStreamReader,
)

CHUNKS = [f"chunk{i}".encode() for i in range(5)]
EXPECTED = b"".join(CHUNKS)


def _start_chunked_server() -> int:
    """Start a one-shot HTTP server that replies with a chunked body. Returns its port."""
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
            for chunk in CHUNKS:
                conn.sendall(f"{len(chunk):x}\r\n".encode() + chunk + b"\r\n")
            conn.sendall(b"0\r\n\r\n")
            conn.close()
        except OSError:
            pass
        finally:
            sock.close()

    threading.Thread(target=serve, daemon=True).start()
    return port


def _active_connections(client) -> int:
    return len(client._transport._pool.connections)


def _open_stream(client, port):
    request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
    return client.send(request, stream=True)


def test_sync_full_consume_releases_connection():
    with httpx.Client() as client:
        port = _start_chunked_server()
        reader = FileStreamReader(_open_stream(client, port))
        assert b"".join(reader) == EXPECTED
        assert _active_connections(client) == 0


def test_sync_context_manager_releases_on_exit():
    with httpx.Client() as client:
        port = _start_chunked_server()
        with FileStreamReader(_open_stream(client, port)) as reader:
            assert next(iter(reader)) == CHUNKS[0]
        # Exiting the context releases the connection even though the stream
        # was only partially consumed.
        assert _active_connections(client) == 0


def test_sync_close_is_idempotent():
    with httpx.Client() as client:
        port = _start_chunked_server()
        reader = FileStreamReader(_open_stream(client, port))
        reader.close()
        reader.close()
        assert _active_connections(client) == 0


def test_sync_abandoned_reader_does_not_leak():
    with httpx.Client() as client:
        port = _start_chunked_server()
        reader = FileStreamReader(_open_stream(client, port))
        assert _active_connections(client) == 1
        del reader
        gc.collect()
        # The finalizer releases the connection when the reader is collected.
        assert _active_connections(client) == 0


async def test_async_full_consume_releases_connection():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        reader = AsyncFileStreamReader(await client.send(request, stream=True))
        collected = b"".join([chunk async for chunk in reader])
        assert collected == EXPECTED
        assert _active_connections(client) == 0


async def test_async_context_manager_releases_on_exit():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        async with AsyncFileStreamReader(
            await client.send(request, stream=True)
        ) as reader:
            assert await reader.__anext__() == CHUNKS[0]
        assert _active_connections(client) == 0


async def test_async_aclose_is_idempotent():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        reader = AsyncFileStreamReader(await client.send(request, stream=True))
        await reader.aclose()
        await reader.aclose()
        assert _active_connections(client) == 0


async def test_async_abandoned_reader_does_not_leak():
    import asyncio

    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        reader = AsyncFileStreamReader(await client.send(request, stream=True))
        assert _active_connections(client) == 1
        del reader
        gc.collect()
        # The finalizer schedules aclose on the running loop; let it run.
        await asyncio.sleep(0.05)
        assert _active_connections(client) == 0


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
