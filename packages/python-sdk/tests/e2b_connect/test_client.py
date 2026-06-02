import asyncio
from typing import cast

import pytest
from httpcore import ConnectionPool, RemoteProtocolError

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


class _FakeMsg:
    def SerializeToString(self):
        return b""


class _FakePool:
    def __init__(self):
        self.calls = 0

    def request(self, **kwargs):
        self.calls += 1
        raise RemoteProtocolError("boom")


def test_client_honors_configured_retries(monkeypatch):
    monkeypatch.setattr("e2b_connect.client.time.sleep", lambda _: None)

    pool = _FakePool()
    client = Client(
        pool=cast(ConnectionPool, pool),
        url="http://api.test",
        response_type=object,
        retries=2,
    )

    with pytest.raises(RemoteProtocolError):
        client.call_unary(_FakeMsg())

    assert pool.calls == 3


def test_client_retries_zero_disables_retries(monkeypatch):
    monkeypatch.setattr("e2b_connect.client.time.sleep", lambda _: None)

    pool = _FakePool()
    client = Client(
        pool=cast(ConnectionPool, pool),
        url="http://api.test",
        response_type=object,
        retries=0,
    )

    with pytest.raises(RemoteProtocolError):
        client.call_unary(_FakeMsg())

    assert pool.calls == 1
