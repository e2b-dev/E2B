"""Unit tests for the streamed-upload IO helpers."""

import asyncio
import gzip
import threading
from typing import IO, cast

from e2b.io_utils import agzip_iter, aiter_io_chunks, gzip_iter, iter_io_chunks


def test_iter_io_chunks_encodes_text():
    import io

    assert list(iter_io_chunks(io.BytesIO(b"abc"))) == [b"abc"]
    assert list(iter_io_chunks(io.StringIO("abc"))) == [b"abc"]


def test_gzip_iter_roundtrip():
    compressed = b"".join(gzip_iter([b"hello ", b"world"]))
    assert gzip.decompress(compressed) == b"hello world"


async def test_aiter_io_chunks_roundtrip():
    import io

    chunks = [chunk async for chunk in aiter_io_chunks(io.BytesIO(b"hello"))]
    assert b"".join(chunks) == b"hello"


async def test_agzip_iter_roundtrip():
    async def source():
        yield b"hello "
        yield b"world"

    compressed = b"".join([c async for c in agzip_iter(source())])
    assert gzip.decompress(compressed) == b"hello world"


async def test_aiter_io_chunks_offloads_reads_to_a_thread():
    """A blocking ``read`` must not stall the event loop.

    The reader's ``read`` blocks until a concurrent task releases it; that task
    can only run if the read is off the loop. If the read ran on the loop, the
    releaser would never run and ``release.wait`` would time out, failing the
    ``released`` assertion.
    """
    started = threading.Event()
    release = threading.Event()
    result = {"released": None}

    class BlockingReader:
        def __init__(self):
            self._done = False

        def read(self, _n):
            if self._done:
                return b""
            started.set()
            result["released"] = release.wait(2)
            self._done = True
            return b"data"

    async def releaser():
        while not started.is_set():
            await asyncio.sleep(0.01)
        release.set()

    async def collect():
        reader = cast(IO, BlockingReader())
        return [chunk async for chunk in aiter_io_chunks(reader)]

    _, chunks = await asyncio.gather(releaser(), collect())
    assert result["released"] is True
    assert chunks == [b"data"]
