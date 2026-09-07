from unittest.mock import AsyncMock, Mock

import pytest
from httpx import Response

from e2b import SandboxException
from e2b_code_interpreter.models import format_exception
from tests.conftest import _wait_for_kernel, _wait_for_kernel_async


def java_not_ready_error() -> SandboxException:
    return SandboxException("500:")


def traced_not_ready_error() -> SandboxException:
    return format_exception(
        Response(
            500,
            text="",
            headers={"X-E2B-Trace-ID": "trace-123"},
        ),
        include_diagnostics=True,
    )


@pytest.mark.parametrize("language", ["java", "r"])
def test_waits_through_repeated_kernel_readiness_500s(language):
    run_code = Mock(
        side_effect=[
            java_not_ready_error(),
            java_not_ready_error(),
            java_not_ready_error(),
            None,
        ]
    )
    sandbox = Mock(run_code=run_code)

    _wait_for_kernel(sandbox, language)

    assert run_code.call_count == 4
    run_code.assert_called_with("1", language=language)


def test_propagates_a_persistent_java_readiness_500():
    final_error = java_not_ready_error()
    run_code = Mock(
        side_effect=[
            java_not_ready_error(),
            java_not_ready_error(),
            java_not_ready_error(),
            final_error,
        ]
    )
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        _wait_for_kernel(sandbox, "java")

    assert raised.value is final_error
    assert run_code.call_count == 4


def test_does_not_retry_an_unrelated_java_error():
    error = SandboxException("401: unauthorized")
    run_code = Mock(side_effect=error)
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        _wait_for_kernel(sandbox, "java")

    assert raised.value is error
    run_code.assert_called_once_with("1", language="java")


@pytest.mark.parametrize("language", ["java", "r"])
async def test_async_waits_through_repeated_kernel_readiness_500s(language):
    run_code = AsyncMock(
        side_effect=[
            java_not_ready_error(),
            java_not_ready_error(),
            java_not_ready_error(),
            None,
        ]
    )
    sandbox = Mock(run_code=run_code)

    await _wait_for_kernel_async(sandbox, language)

    assert run_code.await_count == 4
    run_code.assert_awaited_with("1", language=language)


async def test_async_propagates_a_persistent_java_readiness_500():
    final_error = java_not_ready_error()
    run_code = AsyncMock(
        side_effect=[
            java_not_ready_error(),
            java_not_ready_error(),
            java_not_ready_error(),
            final_error,
        ]
    )
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        await _wait_for_kernel_async(sandbox, "java")

    assert raised.value is final_error
    assert run_code.await_count == 4


async def test_async_does_not_retry_an_unrelated_java_error():
    error = SandboxException("401: unauthorized")
    run_code = AsyncMock(side_effect=error)
    sandbox = Mock(run_code=run_code)

    with pytest.raises(SandboxException) as raised:
        await _wait_for_kernel_async(sandbox, "java")

    assert raised.value is error
    run_code.assert_awaited_once_with("1", language="java")


def test_retries_an_empty_readiness_500_with_trace_id():
    run_code = Mock(side_effect=[traced_not_ready_error(), None])
    sandbox = Mock(run_code=run_code)

    _wait_for_kernel(sandbox, "r")

    assert run_code.call_count == 2
