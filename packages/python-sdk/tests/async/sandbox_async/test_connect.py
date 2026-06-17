import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from e2b import AsyncSandbox
from e2b.api.client.api.sandboxes import post_sandboxes_sandbox_id_connect
from e2b.api.client.models import Sandbox as SandboxModel
import e2b.sandbox_async.main as sandbox_async_main


@pytest.mark.skip_debug()
async def test_connect(async_sandbox_factory):
    sbx = await async_sandbox_factory(timeout=10)

    assert await sbx.is_running()

    sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)
    assert await sbx_connection.is_running()


@pytest.mark.skip_debug()
async def test_connect_with_secure(async_sandbox_factory):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sbx = await async_sandbox_factory(timeout=10, secure=True)
    assert await sbx.is_running()

    sbx_connection = await AsyncSandbox.connect(sbx.sandbox_id)

    await sbx_connection.files.make_dir(dir_name)
    files = await sbx_connection.files.list(dir_name)
    assert len(files) == 0
    assert await sbx_connection.is_running()


@pytest.mark.skip_debug()
async def test_connect_to_paused_sandbox_resumes(async_sandbox):
    await async_sandbox.pause()
    assert not await async_sandbox.is_running()

    resumed = await AsyncSandbox.connect(async_sandbox.sandbox_id)
    assert await resumed.is_running()


@pytest.mark.skip_debug()
async def test_resume_does_not_shorten_timeout_on_running_sandbox(
    async_sandbox_factory,
):
    # Create sandbox with a 300 second timeout
    sbx = await async_sandbox_factory(timeout=300)
    assert await sbx.is_running()

    # Get initial info to check end_at
    info_before = await AsyncSandbox.get_info(sbx.sandbox_id)

    # Connect with a shorter timeout (10 seconds)
    await AsyncSandbox.connect(sbx.sandbox_id, timeout=10)

    # Get info after connection
    info_after = await AsyncSandbox.get_info(sbx.sandbox_id)

    # The end_at time should not have been shortened. It should be the same
    assert info_after.end_at == info_before.end_at, (
        f"Timeout was changed: before={info_before.end_at}, after={info_after.end_at}"
    )


@pytest.mark.skip_debug()
async def test_connect_extends_timeout_on_running_sandbox(async_sandbox):
    # Create sandbox with a short timeout
    assert await async_sandbox.is_running()

    # Get initial info to check end_at
    info_before = await async_sandbox.get_info()

    # Connect with a longer timeout
    await AsyncSandbox.connect(async_sandbox.sandbox_id, timeout=600)

    # Get info after connection
    info_after = await AsyncSandbox.get_info(async_sandbox.sandbox_id)

    # The end_at time should have been extended
    assert info_after.end_at > info_before.end_at, (
        f"Timeout was not extended: before={info_before.end_at}, after={info_after.end_at}"
    )


async def test_connect_in_debug_mode_does_not_call_api(monkeypatch, test_api_key):
    mock_connect = AsyncMock()
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_connect)

    sbx = await AsyncSandbox.connect("sbx-debug", debug=True, api_key=test_api_key)

    mock_connect.assert_not_called()
    assert sbx.sandbox_id == "sbx-debug"
    assert sbx._envd_access_token is None
    assert sbx.traffic_access_token is None


async def test_connect_in_env_debug_mode_does_not_call_api(monkeypatch, test_api_key):
    monkeypatch.setenv("E2B_DEBUG", "true")
    mock_connect = AsyncMock()
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_connect)

    sbx = await AsyncSandbox.connect("sbx-debug", api_key=test_api_key)

    mock_connect.assert_not_called()
    assert sbx.sandbox_id == "sbx-debug"


async def test_instance_connect_in_debug_mode_does_not_call_api(
    monkeypatch, test_api_key
):
    mock_connect = AsyncMock()
    monkeypatch.setattr(sandbox_async_main.SandboxApi, "_cls_connect", mock_connect)

    sbx = await AsyncSandbox.connect("sbx-debug", debug=True, api_key=test_api_key)

    assert await sbx.connect() is sbx
    mock_connect.assert_not_called()


async def test_connect_normalizes_unset_tokens(monkeypatch, test_api_key):
    # Tokens and domain are absent in the API response for non-secure sandboxes
    model = SandboxModel(
        client_id="client-id",
        envd_version="0.2.4",
        sandbox_id="sbx-test",
        template_id="template-id",
    )
    mock_request = AsyncMock(
        return_value=SimpleNamespace(status_code=200, parsed=model)
    )
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_connect, "asyncio_detailed", mock_request
    )

    sbx = await AsyncSandbox.connect("sbx-test", debug=False, api_key=test_api_key)

    mock_request.assert_called_once()
    assert sbx._envd_access_token is None
    assert sbx.traffic_access_token is None
    assert "signature" not in sbx.download_url("test.txt")
