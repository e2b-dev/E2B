from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import (
    AsyncSandbox,
    RateLimitException,
    Sandbox,
    SandboxException,
    SandboxForkException,
)
from e2b.api.client.api.sandboxes import (
    post_sandboxes_sandbox_id_fork,
    post_v2_sandboxes,
)
from e2b.api.client.models import (
    Error as ErrorModel,
    Sandbox as SandboxModel,
    SandboxForkResult,
)


def _created_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id="source-sandbox",
            template_id="base",
        ),
    )


def _fork_results(include_error=True):
    results = [
        SandboxForkResult(
            sandbox=SandboxModel(
                client_id="client-id",
                envd_version="0.2.4",
                sandbox_id="fork-1",
                template_id="base",
            )
        )
    ]
    if include_error:
        results.append(
            SandboxForkResult(error=ErrorModel(code=429, message="rate limited"))
        )
    else:
        results.append(
            SandboxForkResult(
                sandbox=SandboxModel(
                    client_id="client-id",
                    envd_version="0.2.4",
                    sandbox_id="fork-2",
                    template_id="base",
                )
            )
        )
    return results


def _mock_sync_fork(monkeypatch, include_error=True):
    request = Mock(
        return_value=SimpleNamespace(
            status_code=200,
            parsed=_fork_results(include_error),
        )
    )
    monkeypatch.setattr(post_sandboxes_sandbox_id_fork, "sync_detailed", request)
    return request


def _mock_async_fork(monkeypatch, include_error=True):
    request = AsyncMock(
        return_value=SimpleNamespace(
            status_code=200,
            parsed=_fork_results(include_error),
        )
    )
    monkeypatch.setattr(post_sandboxes_sandbox_id_fork, "asyncio_detailed", request)
    return request


def _create_sync_sandbox(monkeypatch, api_key):
    monkeypatch.setattr(
        post_v2_sandboxes,
        "sync_detailed",
        Mock(return_value=_created_sandbox()),
    )
    return Sandbox.create(api_key=api_key)


async def _create_async_sandbox(monkeypatch, api_key):
    monkeypatch.setattr(
        post_v2_sandboxes,
        "asyncio_detailed",
        AsyncMock(return_value=_created_sandbox()),
    )
    return await AsyncSandbox.create(api_key=api_key)


def _assert_failed_fork_exception(error, sandbox_class):
    assert isinstance(error, SandboxException)
    assert len(error.results) == 2
    assert isinstance(error.results[0], sandbox_class)
    assert error.results[0].sandbox_id == "fork-1"
    assert isinstance(error.results[1], RateLimitException)
    assert "1 of 2" in str(error)
    assert "rate limited" in str(error)


def test_sync_fork_returns_sandbox_and_exception_by_default(monkeypatch, test_api_key):
    request = _mock_sync_fork(monkeypatch)

    results = Sandbox.fork("source-sandbox", api_key=test_api_key)

    assert len(results) == 2
    assert isinstance(results[0], Sandbox)
    assert isinstance(results[1], RateLimitException)
    assert "raise_on_exception" not in request.call_args.kwargs["body"].to_dict()


def test_sync_static_fork_raises_with_full_results(monkeypatch, test_api_key):
    _mock_sync_fork(monkeypatch)

    with pytest.raises(SandboxForkException) as exc_info:
        Sandbox.fork(
            "source-sandbox",
            api_key=test_api_key,
            raise_on_exception=True,
        )

    _assert_failed_fork_exception(exc_info.value, Sandbox)


def test_sync_instance_fork_raises_with_full_results(monkeypatch, test_api_key):
    sandbox = _create_sync_sandbox(monkeypatch, test_api_key)
    _mock_sync_fork(monkeypatch)

    with pytest.raises(SandboxForkException) as exc_info:
        sandbox.fork(raise_on_exception=True)

    _assert_failed_fork_exception(exc_info.value, Sandbox)


def test_sync_fork_returns_sandboxes_when_all_succeed(monkeypatch, test_api_key):
    _mock_sync_fork(monkeypatch, include_error=False)

    forks = Sandbox.fork(
        "source-sandbox",
        api_key=test_api_key,
        raise_on_exception=True,
    )

    assert len(forks) == 2
    assert all(isinstance(fork, Sandbox) for fork in forks)


async def test_async_fork_returns_sandbox_and_exception_by_default(
    monkeypatch, test_api_key
):
    request = _mock_async_fork(monkeypatch)

    results = await AsyncSandbox.fork("source-sandbox", api_key=test_api_key)

    assert len(results) == 2
    assert isinstance(results[0], AsyncSandbox)
    assert isinstance(results[1], RateLimitException)
    assert "raise_on_exception" not in request.call_args.kwargs["body"].to_dict()


async def test_async_static_fork_raises_with_full_results(monkeypatch, test_api_key):
    _mock_async_fork(monkeypatch)

    with pytest.raises(SandboxForkException) as exc_info:
        await AsyncSandbox.fork(
            "source-sandbox",
            api_key=test_api_key,
            raise_on_exception=True,
        )

    _assert_failed_fork_exception(exc_info.value, AsyncSandbox)


async def test_async_instance_fork_raises_with_full_results(monkeypatch, test_api_key):
    sandbox = await _create_async_sandbox(monkeypatch, test_api_key)
    _mock_async_fork(monkeypatch)

    with pytest.raises(SandboxForkException) as exc_info:
        await sandbox.fork(raise_on_exception=True)

    error = exc_info.value
    assert isinstance(error, SandboxException)
    assert len(error.results) == 2
    assert isinstance(error.results[0], AsyncSandbox)
    assert error.results[0].sandbox_id == "fork-1"
    assert isinstance(error.results[1], RateLimitException)
    assert "1 of 2" in str(error)
    assert "rate limited" in str(error)


async def test_async_fork_returns_sandboxes_when_all_succeed(monkeypatch, test_api_key):
    _mock_async_fork(monkeypatch, include_error=False)

    forks = await AsyncSandbox.fork(
        "source-sandbox",
        api_key=test_api_key,
        raise_on_exception=True,
    )

    assert len(forks) == 2
    assert all(isinstance(fork, AsyncSandbox) for fork in forks)
