import asyncio

import pytest

from e2b_connect.client import Client, _retry


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


def test_server_stream_timeout_extensions_include_read_write():
    c = Client(url="http://localhost", response_type=object)
    c._codec = type("Codec", (), {"encode": staticmethod(lambda _: b"x"), "content_type": "proto"})

    req = c._prepare_server_stream_request(req=object(), request_timeout=5)
    timeout = req["extensions"]["timeout"]

    assert timeout["connect"] == 5
    assert timeout["pool"] == 5
    assert timeout["read"] == 5
    assert timeout["write"] == 5


def test_server_stream_timeout_extensions_none_when_timeout_unset():
    c = Client(url="http://localhost", response_type=object)
    c._codec = type("Codec", (), {"encode": staticmethod(lambda _: b"x"), "content_type": "proto"})

    req = c._prepare_server_stream_request(req=object(), request_timeout=None)

    assert req["extensions"] is None
