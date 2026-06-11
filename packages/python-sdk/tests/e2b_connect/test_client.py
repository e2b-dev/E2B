import asyncio

import pytest

from e2b_connect.client import (
    EnvelopeFlags,
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


def make_parser():
    return ServerStreamParser(
        decode=lambda data, msg_type: data,
        response_type=None,
    )


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
