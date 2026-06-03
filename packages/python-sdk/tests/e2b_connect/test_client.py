import asyncio
from typing import cast

import httpcore
import pytest
from httpcore import ConnectError, ConnectionPool, RemoteProtocolError

from e2b_connect.client import Client, ConnectException, _retry


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


class _StatusPool:
    def __init__(self, status, headers=None):
        self.status = status
        self.headers = headers or []
        self.calls = 0

    def request(self, **kwargs):
        self.calls += 1
        # `httpcore.ConnectionPool.request` reads and closes before returning.
        res = httpcore.Response(self.status, headers=self.headers, content=b"")
        res.read()
        return res


class _ConnErrorPool:
    def __init__(self):
        self.calls = 0

    def request(self, **kwargs):
        self.calls += 1
        raise ConnectError("refused")


def test_client_retries_429(monkeypatch):
    monkeypatch.setattr("e2b_connect.client.time.sleep", lambda _: None)

    pool = _StatusPool(429, headers=[(b"retry-after", b"0")])
    client = Client(
        pool=cast(ConnectionPool, pool),
        url="http://api.test",
        response_type=object,
        retries=2,
    )

    # 429 is "rejected" — safe to replay even for a non-idempotent RPC.
    with pytest.raises(ConnectException):
        client.call_unary(_FakeMsg())

    assert pool.calls == 3


def test_client_does_not_retry_ambiguous_502(monkeypatch):
    monkeypatch.setattr("e2b_connect.client.time.sleep", lambda _: None)

    pool = _StatusPool(502)
    client = Client(
        pool=cast(ConnectionPool, pool),
        url="http://api.test",
        response_type=object,
        retries=3,
    )

    # 502 is ambiguous for a non-idempotent RPC — must not be replayed.
    with pytest.raises(ConnectException):
        client.call_unary(_FakeMsg())

    assert pool.calls == 1


def test_client_retries_connect_error(monkeypatch):
    monkeypatch.setattr("e2b_connect.client.time.sleep", lambda _: None)

    pool = _ConnErrorPool()
    client = Client(
        pool=cast(ConnectionPool, pool),
        url="http://api.test",
        response_type=object,
        retries=2,
    )

    with pytest.raises(ConnectError):
        client.call_unary(_FakeMsg())

    assert pool.calls == 3
