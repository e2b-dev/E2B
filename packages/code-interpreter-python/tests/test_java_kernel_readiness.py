from unittest.mock import AsyncMock, Mock

import pytest

from e2b import SandboxException
from tests.conftest import _wait_for_java_kernel, _wait_for_java_kernel_async


def java_not_ready_error() -> SandboxException:
    return SandboxException("500:")


def test_retries_one_java_readiness_500():
    run_code = Mock(side_effect=[java_not_ready_error(), None])
    sandbox = Mock(run_code=run_code)

    _wait_for_java_kernel(sandbox)

    assert run_code.call_count == 2
    run_code.assert_called_with("1", language="java")


def test_propagates_a_persistent_java_readiness_500():
    second_error = java_not_ready_error()
    run_code = Mock(side_effect=[java_not_ready_error(), second_error])
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        _wait_for_java_kernel(sandbox)

    assert raised.value is second_error
    assert run_code.call_count == 2


def test_does_not_retry_an_unrelated_java_error():
    error = SandboxException("401: unauthorized")
    run_code = Mock(side_effect=error)
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        _wait_for_java_kernel(sandbox)

    assert raised.value is error
    run_code.assert_called_once_with("1", language="java")


async def test_async_retries_one_java_readiness_500():
    run_code = AsyncMock(side_effect=[java_not_ready_error(), None])
    sandbox = Mock(run_code=run_code)

    await _wait_for_java_kernel_async(sandbox)

    assert run_code.await_count == 2
    run_code.assert_awaited_with("1", language="java")


async def test_async_propagates_a_persistent_java_readiness_500():
    second_error = java_not_ready_error()
    run_code = AsyncMock(side_effect=[java_not_ready_error(), second_error])
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        await _wait_for_java_kernel_async(sandbox)

    assert raised.value is second_error
    assert run_code.await_count == 2


async def test_async_does_not_retry_an_unrelated_java_error():
    error = SandboxException("401: unauthorized")
    run_code = AsyncMock(side_effect=error)
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        await _wait_for_java_kernel_async(sandbox)

    assert raised.value is error
    run_code.assert_awaited_once_with("1", language="java")
