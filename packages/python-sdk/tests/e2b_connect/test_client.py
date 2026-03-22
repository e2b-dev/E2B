import asyncio

import pytest

from e2b_connect.client import _retry


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


def test_server_stream_request_timeout_fallback():
    """Test that streaming requests get default timeouts when request_timeout is None.

    Regression test for https://github.com/e2b-dev/E2B/issues/1128
    When request_timeout is None (the default), streaming requests should fall
    back to the timeout parameter for connect/pool/write to prevent indefinite hangs.
    """
    from e2b_connect.client import Client
    from unittest.mock import MagicMock

    # Use JSON codec to avoid protobuf dependency
    client = Client(
        url="http://localhost:8080",
        response_type=MagicMock,
        json=True,
    )

    # Create a minimal protobuf-like message
    class FakeMsg:
        def SerializeToString(self):
            return b""

    # Case 1: request_timeout=None, timeout=60 -> all four timeouts should be set
    result = client._prepare_server_stream_request(
        FakeMsg(), request_timeout=None, timeout=60
    )
    assert result["extensions"] is not None
    assert result["extensions"]["timeout"]["connect"] == 60
    assert result["extensions"]["timeout"]["pool"] == 60
    assert result["extensions"]["timeout"]["write"] == 60
    assert result["extensions"]["timeout"]["read"] == 60

    # Case 2: request_timeout=30, timeout=60 -> request_timeout wins for connect/pool/write
    result = client._prepare_server_stream_request(
        FakeMsg(), request_timeout=30, timeout=60
    )
    assert result["extensions"]["timeout"]["connect"] == 30
    assert result["extensions"]["timeout"]["pool"] == 30
    assert result["extensions"]["timeout"]["write"] == 30
    assert result["extensions"]["timeout"]["read"] == 60
