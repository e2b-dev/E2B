import inspect
from types import SimpleNamespace
from typing import Any, Dict, Optional, cast
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import post_sandboxes_sandbox_id_connect
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.sandbox_async.sandbox_api import SandboxApi as AsyncSandboxApi
from e2b.sandbox_sync.sandbox_api import SandboxApi as SyncSandboxApi

SANDBOX_ID = "sbx-test"


def _connected_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id=SANDBOX_ID,
            template_id="template-id",
        ),
    )


def _sync_request_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=_connected_sandbox())
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "sync_detailed", request)

    Sandbox.connect(SANDBOX_ID, api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_request_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=_connected_sandbox())
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "asyncio_detailed", request)

    await AsyncSandbox.connect(SANDBOX_ID, api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


# `None` expects memory to be absent from the payload: "restore" is the API's
# own default, so it travels as an omitted field rather than memory: True.
MEMORY_CASES = [
    pytest.param({}, None, id="default"),
    pytest.param({"on_resume": "restore"}, None, id="explicit-restore"),
    pytest.param({"on_resume": "reboot"}, False, id="reboot"),
    # Untyped callers can pass anything; only the "reboot" literal opts into a
    # cold boot, so an unrecognized value must fall back to a memory restore.
    pytest.param(cast(Any, {"on_resume": "Reboot"}), None, id="unrecognized-value"),
]


@pytest.mark.parametrize("kwargs, memory", MEMORY_CASES)
def test_connect_sends_memory_only_for_reboot(
    monkeypatch, test_api_key, kwargs, memory: Optional[bool]
):
    body = _sync_request_body(monkeypatch, test_api_key, **kwargs)

    if memory is None:
        assert "memory" not in body
    else:
        assert body["memory"] is memory


@pytest.mark.parametrize("kwargs, memory", MEMORY_CASES)
async def test_async_connect_sends_memory_only_for_reboot(
    monkeypatch, test_api_key, kwargs, memory: Optional[bool]
):
    body = await _async_request_body(monkeypatch, test_api_key, **kwargs)

    if memory is None:
        assert "memory" not in body
    else:
        assert body["memory"] is memory


def test_instance_connect_carries_on_resume(monkeypatch, test_api_key):
    request = Mock(return_value=_connected_sandbox())
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "sync_detailed", request)

    sandbox = Sandbox.connect(SANDBOX_ID, api_key=test_api_key)

    sandbox.connect(on_resume="reboot")
    assert request.call_args.kwargs["body"].to_dict()["memory"] is False

    sandbox.connect()
    assert "memory" not in request.call_args.kwargs["body"].to_dict()


async def test_async_instance_connect_carries_on_resume(monkeypatch, test_api_key):
    request = AsyncMock(return_value=_connected_sandbox())
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "asyncio_detailed", request)

    sandbox = await AsyncSandbox.connect(SANDBOX_ID, api_key=test_api_key)

    await sandbox.connect(on_resume="reboot")
    assert request.call_args.kwargs["body"].to_dict()["memory"] is False

    await sandbox.connect()
    assert "memory" not in request.call_args.kwargs["body"].to_dict()


# `class_method_variant` wraps the instance method with `functools.wraps`, so
# `inspect.signature(Sandbox.connect)` resolves to `(self, timeout, *, on_resume)`
# and never sees the static-by-id chain. Each form is asserted directly.
KEYWORD_ONLY_FORMS = [
    pytest.param(Sandbox, "_cls_connect_sandbox", id="sync-by-id"),
    pytest.param(AsyncSandbox, "_cls_connect_sandbox", id="async-by-id"),
    pytest.param(SyncSandboxApi, "_cls_connect", id="sync-api"),
    pytest.param(AsyncSandboxApi, "_cls_connect", id="async-api"),
]


@pytest.mark.parametrize("owner, attr", KEYWORD_ONLY_FORMS)
def test_on_resume_is_keyword_only(owner, attr):
    # An optional parameter must not extend the positional chain, or
    # `connect(sandbox_id, 300, logger, "reboot")` becomes a valid call.
    signature = inspect.signature(getattr(owner, attr))

    assert signature.parameters["on_resume"].kind is inspect.Parameter.KEYWORD_ONLY
    for pre_existing in ("timeout", "logger"):
        assert (
            signature.parameters[pre_existing].kind
            is not inspect.Parameter.KEYWORD_ONLY
        )

    with pytest.raises(TypeError):
        signature.bind(SANDBOX_ID, 300, None, "reboot")

    assert signature.bind(SANDBOX_ID, on_resume="reboot").arguments["on_resume"] == (
        "reboot"
    )


@pytest.mark.parametrize("sandbox", [Sandbox, AsyncSandbox], ids=["sync", "async"])
def test_on_resume_is_keyword_only_on_the_instance_form(sandbox):
    signature = inspect.signature(sandbox.connect)

    assert signature.parameters["on_resume"].kind is inspect.Parameter.KEYWORD_ONLY
    assert signature.parameters["timeout"].kind is not inspect.Parameter.KEYWORD_ONLY
