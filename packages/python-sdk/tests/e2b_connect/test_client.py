import asyncio

import gzip

import pytest

from e2b_connect.client import (
    Code,
    ConnectException,
    EnvelopeFlags,
    GzipCompressor,
    ServerStreamParser,
    _retry,
    encode_envelope,
)


class GoodError(Exception):
    pass


class BadError(Exception):
    pass


def test_sync_retry_after_expected_exception():
    total = 0

    @_retry(GoodError, 1)
    def f():
        nonlocal total
        total += 1
        raise GoodError()

    with pytest.raises(GoodError):
        f()

    assert total == 2


def test_sync_do_not_retry_on_unexpected_exception():
    total = 0

    @_retry(GoodError, 1)
    def f():
        nonlocal total
        total += 1
        raise BadError()

    with pytest.raises(BadError):
        f()

    assert total == 1


def test_sync_do_not_throw_when_retry_works():
    total = 0

    @_retry(GoodError, 1)
    def f():
        nonlocal total
        total += 1

        if total < 2:
            raise GoodError()

        return True

    result = f()
    assert result is True
    assert total == 2


async def test_async_retry_after_expected_exception():
    total = 0

    @_retry(GoodError, 1)
    async def f():
        nonlocal total
        total += 1
        raise GoodError()

    with pytest.raises(GoodError):
        await f()

    assert total == 2


async def test_async_do_not_retry_on_unexpected_exception():
    total = 0

    @_retry(GoodError, 1)
    async def f():
        nonlocal total
        total += 1
        raise BadError()

    with pytest.raises(BadError):
        await f()

    assert total == 1


async def test_async_do_not_throw_when_retry_works():
    total = 0

    @_retry(GoodError, 1)
    async def f():
        nonlocal total
        total += 1

        if total < 2:
            raise GoodError()

        return True

    result = await f()
    assert result is True
    assert total == 2


async def test_async_with_multiple_await_calls():
    total = 0

    async def a():
        await asyncio.sleep(0.001)

    @_retry(GoodError, 1)
    async def f():
        nonlocal total
        total += 1

        await a()

        if total < 2:
            raise GoodError()

        await a()

        return True

    result = await f()
    assert result is True
    assert total == 2


def test_parser_yields_messages_from_single_chunk():
    parser = make_parser()
    envelope = encode_envelope(flags=EnvelopeFlags(0), data=b"abc")

    assert list(parser.parse(envelope)) == [b"abc"]


def test_parser_handles_payload_split_after_header():
    parser = make_parser()
    envelope = encode_envelope(flags=EnvelopeFlags(0), data=b"abc")

    # The header plus one payload byte arrive first; the remaining payload
    # (shorter than a header) arrives in a later chunk.
    assert list(parser.parse(envelope[:6])) == []
    assert list(parser.parse(envelope[6:])) == [b"abc"]


def test_parser_handles_end_stream_payload_shorter_than_header():
    parser = make_parser()
    envelope = encode_envelope(flags=EnvelopeFlags.end_stream, data=b"{}")

    assert list(parser.parse(envelope[:5])) == []
    assert list(parser.parse(envelope[5:])) == []


def test_parser_decompresses_compressed_message():
    parser = make_parser(compressor=GzipCompressor)
    payload = b"hello streaming world"
    compressed = gzip.compress(payload, compresslevel=1)
    envelope = encode_envelope(flags=EnvelopeFlags.compressed, data=compressed)

    result = list(parser.parse(envelope))
    assert result == [payload]


def test_parser_decompresses_compressed_message_split_across_chunks():
    parser = make_parser(compressor=GzipCompressor)
    payload = b"split compressed payload data"
    compressed = gzip.compress(payload, compresslevel=1)
    envelope = encode_envelope(flags=EnvelopeFlags.compressed, data=compressed)

    # Split in the middle of the payload
    mid = len(envelope) // 2
    assert list(parser.parse(envelope[:mid])) == []
    assert list(parser.parse(envelope[mid:])) == [payload]


def test_parser_raises_when_compressed_but_no_compressor():
    parser = make_parser()  # no compressor
    compressed = gzip.compress(b"data", compresslevel=1)
    envelope = encode_envelope(flags=EnvelopeFlags.compressed, data=compressed)

    with pytest.raises(ConnectException) as exc_info:
        list(parser.parse(envelope))

    assert exc_info.value.status == Code.internal
    assert "no compressor configured" in exc_info.value.message


def test_parser_raises_on_malformed_end_stream_json():
    parser = make_parser()
    envelope = encode_envelope(
        flags=EnvelopeFlags.end_stream,
        data=b"not valid json{{{",
    )

    with pytest.raises(ConnectException) as exc_info:
        list(parser.parse(envelope))

    assert exc_info.value.status == Code.internal
    assert "malformed end-stream" in exc_info.value.message


def test_parser_end_stream_without_error_returns_silently():
    parser = make_parser()
    envelope = encode_envelope(
        flags=EnvelopeFlags.end_stream,
        data=b'{"status": "ok"}',
    )

    assert list(parser.parse(envelope)) == []


def test_parser_handles_many_messages_with_buffer_compaction():
    """Verify the bytearray-based buffer handles many sequential messages
    without losing data — exercises the compaction path in shift_buffer."""
    parser = make_parser()
    messages = [f"msg-{i}".encode() for i in range(50)]
    envelopes = b"".join(
        encode_envelope(flags=EnvelopeFlags(0), data=m) for m in messages
    )

    # Feed one byte at a time to stress the buffer management.
    results = []
    for byte in envelopes:
        results.extend(parser.parse(bytes([byte])))

    assert results == messages


def make_parser(compressor=None):
    return ServerStreamParser(
        decode=lambda data, msg_type: data,
        response_type=None,
        compressor=compressor,
    )
