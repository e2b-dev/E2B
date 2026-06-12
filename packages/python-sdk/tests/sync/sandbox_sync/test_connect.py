import uuid
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from e2b import Sandbox
from e2b.api.client.api.sandboxes import post_sandboxes_sandbox_id_connect
from e2b.api.client.models import Sandbox as SandboxModel
import e2b.sandbox_sync.main as sandbox_sync_main


@pytest.mark.skip_debug()
def test_connect(sandbox_factory):
    sbx = sandbox_factory(timeout=10)

    assert sbx.is_running()

    sbx_connection = Sandbox.connect(sbx.sandbox_id)
    assert sbx_connection.is_running()


@pytest.mark.skip_debug()
def test_connect_with_secure(sandbox_factory):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sbx = sandbox_factory(timeout=10, secure=True)

    assert sbx.is_running()

    sbx_connection = Sandbox.connect(sbx.sandbox_id)

    sbx_connection.files.make_dir(dir_name)
    files = sbx_connection.files.list(dir_name)
    assert len(files) == 0


@pytest.mark.skip_debug()
def test_connect_to_paused_sandbox_resumes(sandbox):
    sandbox.pause()
    assert not sandbox.is_running()

    resumed = Sandbox.connect(sandbox.sandbox_id)
    assert resumed.is_running()


@pytest.mark.skip_debug()
def test_resume_does_not_shorten_timeout_on_running_sandbox(sandbox_factory):
    # Create sandbox with a 300 second timeout
    sbx = sandbox_factory(timeout=300)
    assert sbx.is_running()

    # Get initial info to check end_at
    info_before = Sandbox.get_info(sbx.sandbox_id)

    # Connect with a shorter timeout (10 seconds)
    Sandbox.connect(sbx.sandbox_id, timeout=10)

    # Get info after connection
    info_after = Sandbox.get_info(sbx.sandbox_id)

    # The end_at time should not have been shortened. It should be the same
    assert info_after.end_at == info_before.end_at, (
        f"Timeout was shortened: before={info_before.end_at}, after={info_after.end_at}"
    )


@pytest.mark.skip_debug()
def test_connect_extends_timeout_on_running_sandbox(sandbox):
    # Get initial info to check end_at
    info_before = sandbox.get_info()

    # Connect with a longer timeout
    Sandbox.connect(sandbox.sandbox_id, timeout=600)

    # Get info after connection
    info_after = sandbox.get_info()

    # The end_at time should have been extended
    assert info_after.end_at > info_before.end_at, (
        f"Timeout was not extended: before={info_before.end_at}, after={info_after.end_at}"
    )


def test_connect_in_debug_mode_does_not_call_api(monkeypatch, test_api_key):
    mock_connect = Mock()
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_connect", mock_connect)

    sbx = Sandbox.connect("sbx-debug", debug=True, api_key=test_api_key)

    mock_connect.assert_not_called()
    assert sbx.sandbox_id == "sbx-debug"
    assert sbx._envd_access_token is None
    assert sbx.traffic_access_token is None


def test_instance_connect_in_debug_mode_does_not_call_api(monkeypatch, test_api_key):
    mock_connect = Mock()
    monkeypatch.setattr(sandbox_sync_main.SandboxApi, "_cls_connect", mock_connect)

    sbx = Sandbox.connect("sbx-debug", debug=True, api_key=test_api_key)

    assert sbx.connect() is sbx
    mock_connect.assert_not_called()


def test_connect_normalizes_unset_tokens(monkeypatch, test_api_key):
    # Tokens and domain are absent in the API response for non-secure sandboxes
    model = SandboxModel(
        client_id="client-id",
        envd_version="0.2.4",
        sandbox_id="sbx-test",
        template_id="template-id",
    )
    mock_request = Mock(return_value=SimpleNamespace(status_code=200, parsed=model))
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_connect, "sync_detailed", mock_request
    )

    sbx = Sandbox.connect("sbx-test", debug=False, api_key=test_api_key)

    mock_request.assert_called_once()
    assert sbx._envd_access_token is None
    assert sbx.traffic_access_token is None
    assert "signature" not in sbx.download_url("test.txt")
