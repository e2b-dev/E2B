"""Unit tests for the streamed-read helpers.

These exercise connection lifecycle (consume / context manager / explicit
close / idle timeout / abandonment) without hitting a real sandbox, using a
local chunked HTTP server.
"""

import asyncio
import socket
import threading
import time
from typing import Optional

import httpx
import pytest

from e2b.sandbox.filesystem.filesystem import (
    AsyncFileStreamReader,
    FileStreamReader,
)

CHUNKS = [f"chunk{i}".encode() for i in range(5)]
EXPECTED = b"".join(CHUNKS)


def _start_chunked_server(
    stall_before: Optional[int] = None,
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
                if stall_before is not None and idx == stall_before:
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


def _active_connections(client) -> int:
    # Count connections that are still checked out (a leaked/in-use stream),
    # not the total pool size. A fully consumed stream returns its connection
    # to the pool, where it may linger as an idle keep-alive entry until the
    # server-side close is observed; that lingering idle connection is not a
    # leak. Asserting on total pool size makes this racy under load (the basis
    # of a CI flake); counting only non-idle connections is deterministic.
    return sum(1 for conn in client._transport._pool.connections if not conn.is_idle())


def _open_stream(client, port, read_timeout: Optional[float] = None):
    request = client.build_request(
        "GET", f"http://127.0.0.1:{port}/files", timeout=httpx.Timeout(5.0)
    )
    if read_timeout is not None:
        # Mirror the SDK: the per-chunk `read` timeout bounds idle gaps.
        request.extensions["timeout"]["read"] = read_timeout
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


def test_sync_idle_timeout_releases_connection():
    with httpx.Client() as client:
        # The server stalls before the second chunk for longer than the
        # reader's idle (read) timeout.
        port = _start_chunked_server(stall_before=1, stall_seconds=0.5)
        reader = FileStreamReader(_open_stream(client, port, read_timeout=0.05))
        it = iter(reader)
        assert next(it)
        # The stalled read trips the idle timeout, which propagates and
        # releases the connection.
        with pytest.raises(httpx.ReadTimeout):
            next(it)
        assert _active_connections(client) == 0


def test_sync_abandoned_reader_is_reclaimed_on_client_close():
    client = httpx.Client()
    port = _start_chunked_server()
    reader = FileStreamReader(_open_stream(client, port))
    assert _active_connections(client) == 1

    # The sync reader has no GC safety net: dropping it without closing keeps
    # the connection checked out (an idle timeout would reclaim a stalled one).
    del reader
    assert _active_connections(client) == 1

    # Closing the client reclaims the abandoned connection.
    client.close()
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


async def test_async_idle_timeout_releases_connection():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server(stall_before=1, stall_seconds=0.5)
        request = client.build_request(
            "GET", f"http://127.0.0.1:{port}/files", timeout=httpx.Timeout(5.0)
        )
        request.extensions["timeout"]["read"] = 0.05
        reader = AsyncFileStreamReader(await client.send(request, stream=True))
        it = reader.__aiter__()
        assert await it.__anext__()
        # The stalled read trips the idle timeout, which propagates and
        # releases the connection.
        with pytest.raises(httpx.ReadTimeout):
            await it.__anext__()
        assert _active_connections(client) == 0


async def test_async_abandoned_reader_is_reclaimed_on_client_close():
    client = httpx.AsyncClient()
    port = _start_chunked_server()
    request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
    reader = AsyncFileStreamReader(await client.send(request, stream=True))
    assert _active_connections(client) == 1

    # The async reader has no GC safety net: dropping it without closing keeps
    # the connection checked out (releasing one requires awaiting aclose()).
    del reader
    await asyncio.sleep(0.05)
    assert _active_connections(client) == 1

    # Closing the client reclaims the abandoned connection.
    await client.aclose()
    assert _active_connections(client) == 0


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
