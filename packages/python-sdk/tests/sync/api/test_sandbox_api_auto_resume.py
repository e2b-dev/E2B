from types import SimpleNamespace

from e2b.sandbox_sync.sandbox_api import SandboxApi
import e2b.sandbox_sync.sandbox_api as sandbox_api_mod


def _fake_parsed_response():
    return SimpleNamespace(
        sandbox_id="sandbox-123",
        domain=None,
        envd_version="0.2.4",
        envd_access_token=None,
        traffic_access_token=None,
    )


def test_create_sandbox_includes_auto_resume_when_set(monkeypatch):
    captured = {}

    def fake_get_api_client(_config):
        return object()

    def fake_sync_detailed(*, body, client):
        captured["body"] = body
        assert client is not None
        return SimpleNamespace(status_code=201, parsed=_fake_parsed_response())

    monkeypatch.setattr(sandbox_api_mod, "get_api_client", fake_get_api_client)
    monkeypatch.setattr(sandbox_api_mod.post_sandboxes, "sync_detailed", fake_sync_detailed)

    SandboxApi._create_sandbox(
        template="base",
        timeout=5,
        auto_pause=False,
        auto_resume={"policy": "any"},
        allow_internet_access=True,
        metadata=None,
        env_vars=None,
        secure=True,
    )

    payload = captured["body"].to_dict()
    assert payload["autoResume"] == {"policy": "any"}


def test_create_sandbox_omits_auto_resume_when_none(monkeypatch):
    captured = {}

    def fake_get_api_client(_config):
        return object()

    def fake_sync_detailed(*, body, client):
        captured["body"] = body
        assert client is not None
        return SimpleNamespace(status_code=201, parsed=_fake_parsed_response())

    monkeypatch.setattr(sandbox_api_mod, "get_api_client", fake_get_api_client)
    monkeypatch.setattr(sandbox_api_mod.post_sandboxes, "sync_detailed", fake_sync_detailed)

    SandboxApi._create_sandbox(
        template="base",
        timeout=5,
        auto_pause=False,
        auto_resume=None,
        allow_internet_access=True,
        metadata=None,
        env_vars=None,
        secure=True,
    )

    payload = captured["body"].to_dict()
    assert "autoResume" not in payload

