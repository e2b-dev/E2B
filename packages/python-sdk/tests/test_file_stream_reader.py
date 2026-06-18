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
    # Count connections that are still checked out (a leaked/in-use stream),
    # not the total pool size. A fully consumed stream returns its connection
    # to the pool, where it may linger as an idle keep-alive entry until the
    # server-side close is observed; that lingering idle connection is not a
    # leak. Asserting on total pool size makes this racy under load (the basis
    # of a CI flake); counting only non-idle connections is deterministic.
    return sum(1 for conn in client._transport._pool.connections if not conn.is_idle())


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


async def test_async_abandoned_reader_is_reclaimed_on_client_close():
    import asyncio

    client = httpx.AsyncClient()
    port = _start_chunked_server()
    request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
    reader = AsyncFileStreamReader(await client.send(request, stream=True))
    assert _active_connections(client) == 1

    # The async reader has no GC safety net: dropping it without closing keeps
    # the connection checked out (releasing one requires awaiting aclose()).
    del reader
    gc.collect()
    await asyncio.sleep(0.05)
    assert _active_connections(client) == 1

    # Closing the client reclaims the abandoned connection.
    await client.aclose()
    assert _active_connections(client) == 0


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
