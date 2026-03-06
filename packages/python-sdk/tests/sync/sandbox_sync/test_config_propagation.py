from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.sandbox_sync.main import Sandbox
import e2b.sandbox_sync.main as sandbox_sync_main


def make_sandbox() -> Sandbox:
    config = ConnectionConfig(
        api_key="base-api-key",
        domain="base.e2b.dev",
        request_timeout=11,
        headers={"X-Test": "base"},
    )
    return Sandbox(
        sandbox_id="sbx-config-propagation",
        sandbox_domain="sandbox.e2b.dev",
        envd_version=Version("0.2.4"),
        envd_access_token="envd-access-token",
        connection_config=config,
        traffic_access_token="traffic-access-token",
    )


def test_connect_forwards_stored_config_and_allows_overrides(monkeypatch):
    sandbox = make_sandbox()
    captured = []

    def fake_connect(**kwargs):
        captured.append(kwargs)
        return {}

    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_connect", fake_connect)

    sandbox.connect(timeout=10)
    sandbox.connect(
        timeout=15,
        domain="override.e2b.dev",
        request_timeout=20,
    )

    first = captured[0]
    assert first["api_key"] == "base-api-key"
    assert first["domain"] == "base.e2b.dev"
    assert first["request_timeout"] == 11
    assert first["timeout"] == 10

    second = captured[1]
    assert second["api_key"] == "base-api-key"
    assert second["domain"] == "override.e2b.dev"
    assert second["request_timeout"] == 20
    assert second["timeout"] == 15


def test_pause_forwards_stored_config_and_allows_overrides(monkeypatch):
    sandbox = make_sandbox()
    captured = []

    def fake_pause(**kwargs):
        captured.append(kwargs)
        return None

    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_pause", fake_pause)

    sandbox.pause()
    sandbox.pause(
        domain="override.e2b.dev", request_timeout=20, headers={"X-Extra": "1"}
    )

    first = captured[0]
    assert first["api_key"] == "base-api-key"
    assert first["domain"] == "base.e2b.dev"
    assert first["request_timeout"] == 11
    assert first["headers"]["X-Test"] == "base"
    assert "User-Agent" in first["headers"]

    second = captured[1]
    assert second["api_key"] == "base-api-key"
    assert second["domain"] == "override.e2b.dev"
    assert second["request_timeout"] == 20
    assert second["headers"]["X-Test"] == "base"
    assert second["headers"]["X-Extra"] == "1"
