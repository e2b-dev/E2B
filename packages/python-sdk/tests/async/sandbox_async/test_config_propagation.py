from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from packaging.version import Version

from e2b import AsyncSandbox
from e2b.connection_config import ConnectionConfig
import e2b.sandbox_async.main as sandbox_async_main


BASE_API_KEY = "base-api-key"
BASE_DOMAIN = "base.e2b.dev"
BASE_REQUEST_TIMEOUT = 11
BASE_DEBUG = False
BASE_HEADERS = {"X-Test": "base"}


def create_sandbox(monkeypatch) -> AsyncSandbox:
    dummy_transport = SimpleNamespace(pool=object())

    monkeypatch.setattr(
        sandbox_async_main, "get_transport", lambda *_args, **_kwargs: dummy_transport
    )
    monkeypatch.setattr(
        sandbox_async_main.httpx, "AsyncClient", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(
        sandbox_async_main, "Filesystem", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(
        sandbox_async_main, "Commands", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(sandbox_async_main, "Pty", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_async_main, "Git", lambda *args, **kwargs: object())

    return AsyncSandbox(
        sandbox_id="sbx-test",
        sandbox_domain="sandbox.e2b.dev",
        envd_version=Version("0.2.4"),
        envd_access_token="tok",
        traffic_access_token="tok",
        connection_config=ConnectionConfig(
            api_key=BASE_API_KEY,
            domain=BASE_DOMAIN,
            request_timeout=BASE_REQUEST_TIMEOUT,
            debug=BASE_DEBUG,
            headers=BASE_HEADERS,
        ),
    )


@pytest.mark.skip_debug()
async def test_pause_passes_connection_config_without_overrides(monkeypatch):
    mock_pause = AsyncMock(return_value="sbx-test")
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_pause", mock_pause)

    sandbox = create_sandbox(monkeypatch)
    await sandbox.pause()

    mock_pause.assert_awaited_once()
    assert mock_pause.call_args.kwargs["sandbox_id"] == "sbx-test"
    assert mock_pause.call_args.kwargs["api_key"] == BASE_API_KEY
    assert mock_pause.call_args.kwargs["domain"] == BASE_DOMAIN
    assert mock_pause.call_args.kwargs["request_timeout"] == BASE_REQUEST_TIMEOUT
    assert mock_pause.call_args.kwargs["debug"] == BASE_DEBUG
    assert mock_pause.call_args.kwargs["headers"]["X-Test"] == BASE_HEADERS["X-Test"]


@pytest.mark.skip_debug()
async def test_connect_forwards_envs(monkeypatch):
    mock_connect = AsyncMock(return_value=None)
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_connect)

    sandbox = create_sandbox(monkeypatch)
    await sandbox.connect(envs={"MY_KEY": "my_value"})

    mock_connect.assert_awaited_once()
    assert mock_connect.call_args.kwargs["envs"] == {"MY_KEY": "my_value"}


@pytest.mark.skip_debug()
async def test_connect_envs_is_none_when_not_provided(monkeypatch):
    mock_connect = AsyncMock(return_value=None)
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_connect)

    sandbox = create_sandbox(monkeypatch)
    await sandbox.connect()

    mock_connect.assert_awaited_once()
    assert mock_connect.call_args.kwargs.get("envs") is None


@pytest.mark.skip_debug()
async def test_classmethod_connect_forwards_envs_without_polluting_opts(monkeypatch):
    # Regression: AsyncSandbox.connect(id, envs=...) previously passed envs into
    # **opts, which then reached ConnectionConfig(**opts) and raised TypeError.
    mock_cls_connect = AsyncMock(return_value=SimpleNamespace(
        sandbox_id="sbx-test",
        domain="sandbox.e2b.dev",
        envd_version="0.2.4",
        envd_access_token="tok",
        traffic_access_token="tok",
    ))
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_cls_connect)
    monkeypatch.setattr(
        sandbox_async_main, "get_transport", lambda *_args, **_kwargs: SimpleNamespace(pool=object())
    )
    monkeypatch.setattr(sandbox_async_main.httpx, "AsyncClient", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_async_main, "Filesystem", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_async_main, "Commands", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_async_main, "Pty", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_async_main, "Git", lambda *args, **kwargs: object())

    # This must not raise TypeError: ConnectionConfig() got unexpected keyword 'envs'
    await sandbox_async_main.AsyncSandbox.connect("sbx-test", envs={"MY_KEY": "my_value"}, api_key="test-key")

    mock_cls_connect.assert_awaited_once()
    assert mock_cls_connect.call_args.kwargs["envs"] == {"MY_KEY": "my_value"}


@pytest.mark.skip_debug()
async def test_pause_applies_overrides(monkeypatch):
    mock_pause = AsyncMock(return_value="sbx-test")
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_pause", mock_pause)

    sandbox = create_sandbox(monkeypatch)
    await sandbox.pause(
        domain="override.e2b.dev",
        request_timeout=20,
        headers={"X-Extra": "1"},
    )

    mock_pause.assert_awaited_once()
    assert mock_pause.call_args.kwargs["sandbox_id"] == "sbx-test"
    assert mock_pause.call_args.kwargs["api_key"] == BASE_API_KEY
    assert mock_pause.call_args.kwargs["domain"] == "override.e2b.dev"
    assert mock_pause.call_args.kwargs["request_timeout"] == 20
    assert mock_pause.call_args.kwargs["debug"] == BASE_DEBUG
    assert mock_pause.call_args.kwargs["headers"]["X-Test"] == BASE_HEADERS["X-Test"]
    assert mock_pause.call_args.kwargs["headers"]["X-Extra"] == "1"
