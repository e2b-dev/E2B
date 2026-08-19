"""Unit tests for the streamed-read helpers.

These exercise the readers' own lifecycle (consume / context manager /
explicit close / read error / abandonment / idle timeout) against a local
chunked HTTP server. They assert on the reader's contract — the underlying
response is closed, or deliberately left open — rather than on
connection-pool internals, which are private to the transport and absent on
the pyqwest transports the SDK ships.
"""

import asyncio
import gc
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


def _read_request_head(conn) -> None:
    """Read up to the end of the request head.

    Accumulates across reads, since the head can arrive split across TCP
    segments, and stops on a closed peer rather than spinning on empty reads.
    """
    buffered = b""
    while b"\r\n\r\n" not in buffered:
        received = conn.recv(65536)
        if not received:
            return
        buffered += received


def _start_chunked_server(
    stall_before: Optional[int] = None,
    stall_seconds: float = 0.0,
    truncate_before: Optional[int] = None,
) -> int:
    """Start a one-shot HTTP server that replies with a chunked body.

    When ``stall_before`` is not None, the server sleeps ``stall_seconds``
    before sending that chunk index, so a reader with a shorter idle timeout
    times out. When ``truncate_before`` is not None, the server drops the
    connection at that chunk index without the terminating zero-length chunk,
    so a mid-body read raises a protocol error. Returns the server's port.
    """
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(1)
    port = sock.getsockname()[1]

    def serve():
        try:
            conn, _ = sock.accept()
            _read_request_head(conn)
            conn.sendall(
                b"HTTP/1.1 200 OK\r\n"
                b"Content-Type: application/octet-stream\r\n"
                b"Transfer-Encoding: chunked\r\n\r\n"
            )
            for idx, chunk in enumerate(CHUNKS):
                if idx == truncate_before:
                    break
                if idx == stall_before:
                    time.sleep(stall_seconds)
                conn.sendall(f"{len(chunk):x}\r\n".encode() + chunk + b"\r\n")
            else:
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


def test_sync_full_consume_releases_response():
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


def test_sync_read_error_releases_response():
    with httpx.Client() as client:
        port = _start_chunked_server(truncate_before=1)
        response = _open_stream(client, port)
        reader = FileStreamReader(response)
        it = iter(reader)
        assert next(it) == CHUNKS[0]
        # A mid-body error propagates and the reader releases the response.
        # Asserted on the `httpx.HTTPError` base rather than the concrete
        # class, because which error a truncated body surfaces as is the
        # transport's business, not part of the reader's contract.
        with pytest.raises(httpx.HTTPError):
            next(it)
        assert response.is_closed


def test_sync_abandoned_reader_leaves_the_response_open():
    with httpx.Client() as client:
        port = _start_chunked_server()
        response = _open_stream(client, port)
        reader = FileStreamReader(response)
        assert next(iter(reader)) == CHUNKS[0]

        # The reader documents that it has no garbage-collection safety net,
        # so dropping it half-consumed must leave the response — and the
        # pooled connection behind it — open. Callers have to consume it
        # fully, use the context manager, or call `close()`.
        del reader
        gc.collect()
        assert not response.is_closed


async def test_async_full_consume_releases_response():
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


async def test_async_abandoned_reader_leaves_the_response_open():
    async with httpx.AsyncClient() as client:
        port = _start_chunked_server()
        request = client.build_request("GET", f"http://127.0.0.1:{port}/files")
        response = await client.send(request, stream=True)
        reader = AsyncFileStreamReader(response)
        assert await reader.__anext__() == CHUNKS[0]

        # Same contract as the sync reader, and for a stronger reason:
        # releasing an async response requires awaiting `aclose()`, which a
        # finalizer cannot do. Sleeping gives the event loop a chance to run
        # async-generator finalization, so this asserts the response really
        # stays open rather than just outracing the loop.
        del reader
        gc.collect()
        await asyncio.sleep(0.05)
        assert not response.is_closed


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
