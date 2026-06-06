from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from packaging.version import Version

from e2b import Sandbox
from e2b.connection_config import ConnectionConfig
import e2b.sandbox_sync.main as sandbox_sync_main


BASE_DOMAIN = "base.e2b.dev"
BASE_REQUEST_TIMEOUT = 11
BASE_DEBUG = False
BASE_HEADERS = {"X-Test": "base"}


def create_sandbox(monkeypatch, api_key: str) -> Sandbox:
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
        connection_config=ConnectionConfig(
            api_key=api_key,
            domain=BASE_DOMAIN,
            request_timeout=BASE_REQUEST_TIMEOUT,
            debug=BASE_DEBUG,
            api_headers=BASE_HEADERS,
        ),
    )


@pytest.mark.skip_debug()
def test_pause_passes_connection_config_without_overrides(monkeypatch, test_api_key):
    mock_pause = Mock(return_value="sbx-test")
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_pause", mock_pause)

    sandbox = create_sandbox(monkeypatch, test_api_key)
    sandbox.pause()

    mock_pause.assert_called_once()
    assert mock_pause.call_args.kwargs["sandbox_id"] == "sbx-test"
    assert mock_pause.call_args.kwargs["api_key"] == test_api_key
    assert mock_pause.call_args.kwargs["domain"] == BASE_DOMAIN
    assert mock_pause.call_args.kwargs["request_timeout"] == BASE_REQUEST_TIMEOUT
    assert mock_pause.call_args.kwargs["debug"] == BASE_DEBUG
    assert mock_pause.call_args.kwargs["headers"]["X-Test"] == BASE_HEADERS["X-Test"]


@pytest.mark.skip_debug()
def test_pause_applies_overrides(monkeypatch, test_api_key):
    mock_pause = Mock(return_value="sbx-test")
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_pause", mock_pause)

    sandbox = create_sandbox(monkeypatch, test_api_key)
    sandbox.pause(
        domain="override.e2b.dev",
        request_timeout=20,
        api_headers={"X-Extra": "1"},
    )

    mock_pause.assert_called_once()
    assert mock_pause.call_args.kwargs["sandbox_id"] == "sbx-test"
    assert mock_pause.call_args.kwargs["api_key"] == test_api_key
    assert mock_pause.call_args.kwargs["domain"] == "override.e2b.dev"
    assert mock_pause.call_args.kwargs["request_timeout"] == 20
    assert mock_pause.call_args.kwargs["debug"] == BASE_DEBUG
    assert mock_pause.call_args.kwargs["headers"]["X-Test"] == BASE_HEADERS["X-Test"]
    assert mock_pause.call_args.kwargs["headers"]["X-Extra"] == "1"


@pytest.mark.skip_debug()
def test_connect_sets_stable_host_routing_headers(monkeypatch, test_api_key):
    mock_connect = Mock(
        return_value=SimpleNamespace(
            sandbox_id="sbx-test",
            domain="e2b.app",
            envd_version="0.4.0",
            envd_access_token="tok",
            traffic_access_token="traffic",
        )
    )
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_connect", mock_connect)

    sandbox = Sandbox.connect("sbx-test", api_key=test_api_key, headers=BASE_HEADERS)

    assert sandbox.envd_api_url == "https://sandbox.e2b.app"
    assert "X-Test" not in sandbox.connection_config.sandbox_headers
    assert sandbox.connection_config.sandbox_headers["E2b-Sandbox-Id"] == "sbx-test"
    assert sandbox.connection_config.sandbox_headers["E2b-Sandbox-Port"] == str(
        ConnectionConfig.envd_port
    )
    assert sandbox.connection_config.sandbox_headers["X-Access-Token"] == "tok"
