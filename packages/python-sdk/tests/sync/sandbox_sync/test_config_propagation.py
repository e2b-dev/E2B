from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from packaging.version import Version

from e2b import Sandbox
from e2b.connection_config import ConnectionConfig
import e2b.sandbox_sync.main as sandbox_sync_main


BASE_CONFIG = {
    "api_key": "base-api-key",
    "domain": "base.e2b.dev",
    "request_timeout": 11,
    "debug": False,
    "headers": {"X-Test": "base"},
}


def create_sandbox(monkeypatch) -> Sandbox:
    dummy_transport = SimpleNamespace(pool=object())

    monkeypatch.setattr(
        sandbox_sync_main, "get_transport", lambda *_args, **_kwargs: dummy_transport
    )
    monkeypatch.setattr(
        sandbox_sync_main.httpx, "Client", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(
        sandbox_sync_main, "Filesystem", lambda *args, **kwargs: object()
    )
    monkeypatch.setattr(sandbox_sync_main, "Commands", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_sync_main, "Pty", lambda *args, **kwargs: object())
    monkeypatch.setattr(sandbox_sync_main, "Git", lambda *args, **kwargs: object())

    return Sandbox(
        sandbox_id="sbx-test",
        sandbox_domain="sandbox.e2b.dev",
        envd_version=Version("0.2.4"),
        envd_access_token="tok",
        traffic_access_token="tok",
        connection_config=ConnectionConfig(**BASE_CONFIG),
    )


@pytest.mark.skip_debug()
def test_pause_passes_connection_config_without_overrides(monkeypatch):
    mock_pause = Mock(return_value="sbx-test")
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_pause", mock_pause)

    sandbox = create_sandbox(monkeypatch)
    sandbox.pause()

    mock_pause.assert_called_once()
    assert mock_pause.call_args.kwargs["sandbox_id"] == "sbx-test"
    assert mock_pause.call_args.kwargs["api_key"] == BASE_CONFIG["api_key"]
    assert mock_pause.call_args.kwargs["domain"] == BASE_CONFIG["domain"]
    assert (
        mock_pause.call_args.kwargs["request_timeout"] == BASE_CONFIG["request_timeout"]
    )
    assert mock_pause.call_args.kwargs["debug"] == BASE_CONFIG["debug"]
    assert (
        mock_pause.call_args.kwargs["headers"]["X-Test"]
        == BASE_CONFIG["headers"]["X-Test"]
    )


@pytest.mark.skip_debug()
def test_pause_applies_overrides(monkeypatch):
    mock_pause = Mock(return_value="sbx-test")
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_pause", mock_pause)

    sandbox = create_sandbox(monkeypatch)
    sandbox.pause(
        domain="override.e2b.dev",
        request_timeout=20,
        headers={"X-Extra": "1"},
    )

    mock_pause.assert_called_once()
    assert mock_pause.call_args.kwargs["sandbox_id"] == "sbx-test"
    assert mock_pause.call_args.kwargs["api_key"] == BASE_CONFIG["api_key"]
    assert mock_pause.call_args.kwargs["domain"] == "override.e2b.dev"
    assert mock_pause.call_args.kwargs["request_timeout"] == 20
    assert mock_pause.call_args.kwargs["debug"] == BASE_CONFIG["debug"]
    assert (
        mock_pause.call_args.kwargs["headers"]["X-Test"]
        == BASE_CONFIG["headers"]["X-Test"]
    )
    assert mock_pause.call_args.kwargs["headers"]["X-Extra"] == "1"
