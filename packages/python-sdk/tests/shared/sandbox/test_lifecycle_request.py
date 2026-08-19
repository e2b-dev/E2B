from types import SimpleNamespace
from typing import Any, Dict, Optional, cast
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import post_sandboxes
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.exceptions import InvalidArgumentException


def _created_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id="sbx-test",
            template_id="template-id",
        ),
    )


def _sync_request_body(monkeypatch, api_key: str, lifecycle) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, lifecycle=lifecycle)

    return request.call_args.kwargs["body"].to_dict()


async def _async_request_body(monkeypatch, api_key: str, lifecycle) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=api_key, lifecycle=lifecycle)

    return request.call_args.kwargs["body"].to_dict()


# `None` expects autoPause to be absent from the payload: an unconfigured
# timeout action is not a choice of kill, so the API keeps ownership of the
# default instead of receiving autoPause: False.
AUTO_PAUSE_CASES = [
    pytest.param(None, None, id="no-lifecycle"),
    pytest.param({"on_timeout": "kill"}, False, id="explicit-kill"),
    pytest.param({"on_timeout": "pause"}, True, id="explicit-pause"),
    # Untyped callers can build the lifecycle conditionally and leave on_timeout
    # out, or pass it as None; neither selects an action.
    pytest.param(cast(Any, {"auto_resume": False}), None, id="no-on-timeout-key"),
    pytest.param(cast(Any, {"on_timeout": None}), None, id="none-on-timeout"),
]


@pytest.mark.parametrize("lifecycle, auto_pause", AUTO_PAUSE_CASES)
def test_create_sends_auto_pause_only_when_configured(
    monkeypatch, test_api_key, lifecycle, auto_pause: Optional[bool]
):
    body = _sync_request_body(monkeypatch, test_api_key, lifecycle)

    if auto_pause is None:
        assert "autoPause" not in body
    else:
        assert body["autoPause"] is auto_pause
    assert "autoPauseMemory" not in body


@pytest.mark.parametrize("lifecycle, auto_pause", AUTO_PAUSE_CASES)
async def test_async_create_sends_auto_pause_only_when_configured(
    monkeypatch, test_api_key, lifecycle, auto_pause: Optional[bool]
):
    body = await _async_request_body(monkeypatch, test_api_key, lifecycle)

    if auto_pause is None:
        assert "autoPause" not in body
    else:
        assert body["autoPause"] is auto_pause
    assert "autoPauseMemory" not in body


def test_create_omits_auto_pause_memory_when_pause_omits_keep_memory(
    monkeypatch, test_api_key
):
    body = _sync_request_body(
        monkeypatch,
        test_api_key,
        {"on_timeout": {"action": "pause"}},
    )

    assert body["autoPause"] is True
    assert "autoPauseMemory" not in body


def test_create_sends_the_pause_snapshot_kind_alongside_auto_pause(
    monkeypatch, test_api_key
):
    body = _sync_request_body(
        monkeypatch,
        test_api_key,
        {"on_timeout": {"action": "pause", "keep_memory": False}},
    )

    assert body["autoPause"] is True
    assert body["autoPauseMemory"] is False

    body = _sync_request_body(
        monkeypatch,
        test_api_key,
        {"on_timeout": {"action": "pause", "keep_memory": True}},
    )

    assert body["autoPause"] is True
    assert body["autoPauseMemory"] is True


@pytest.mark.parametrize(
    "lifecycle",
    [
        pytest.param(cast(Any, {"auto_resume": True}), id="no-on-timeout-key"),
        pytest.param(
            cast(Any, {"on_timeout": None, "auto_resume": True}), id="none-on-timeout"
        ),
    ],
)
def test_create_rejects_auto_resume_without_a_timeout_action(test_api_key, lifecycle):
    # An unconfigured on_timeout still resolves to kill semantics locally, so
    # auto_resume has no pause to attach to.
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(api_key=test_api_key, lifecycle=lifecycle)


@pytest.mark.parametrize(
    "lifecycle",
    [
        pytest.param(cast(Any, {"auto_resume": True}), id="no-on-timeout-key"),
        pytest.param(
            cast(Any, {"on_timeout": None, "auto_resume": True}), id="none-on-timeout"
        ),
    ],
)
async def test_async_create_rejects_auto_resume_without_a_timeout_action(
    test_api_key, lifecycle
):
    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(api_key=test_api_key, lifecycle=lifecycle)
