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
    # on_timeout is optional, so a lifecycle can leave it out entirely; untyped
    # callers can also pass it as None. Neither selects an action.
    pytest.param({}, None, id="empty-lifecycle"),
    pytest.param({"auto_resume": False}, None, id="no-on-timeout-key"),
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


NO_ACTION_AUTO_RESUME_CASES = [
    pytest.param({"auto_resume": True}, id="no-on-timeout-key"),
    pytest.param(
        cast(Any, {"on_timeout": None, "auto_resume": True}), id="none-on-timeout"
    ),
]


@pytest.mark.parametrize("lifecycle", NO_ACTION_AUTO_RESUME_CASES)
def test_create_rejects_auto_resume_without_a_timeout_action(test_api_key, lifecycle):
    # Auto-resume only has meaning for a sandbox that pauses, so it needs an
    # explicit "pause" rather than whichever action the API would have picked.
    # The message points at the knob to turn instead of naming a default the SDK
    # no longer decides.
    with pytest.raises(
        InvalidArgumentException, match=r"Set lifecycle\['on_timeout'\] to 'pause'"
    ):
        Sandbox.create(api_key=test_api_key, lifecycle=lifecycle)


@pytest.mark.parametrize("lifecycle", NO_ACTION_AUTO_RESUME_CASES)
async def test_async_create_rejects_auto_resume_without_a_timeout_action(
    test_api_key, lifecycle
):
    with pytest.raises(
        InvalidArgumentException, match=r"Set lifecycle\['on_timeout'\] to 'pause'"
    ):
        await AsyncSandbox.create(api_key=test_api_key, lifecycle=lifecycle)


def test_create_rejects_only_a_real_keep_memory_on_a_kill_action(
    monkeypatch, test_api_key
):
    with pytest.raises(InvalidArgumentException):
        Sandbox.create(
            api_key=test_api_key,
            lifecycle=cast(
                Any, {"on_timeout": {"action": "kill", "keep_memory": True}}
            ),
        )

    # A None keep_memory is not a choice, so it doesn't trip the pause-only
    # guard on a kill action.
    body = _sync_request_body(
        monkeypatch,
        test_api_key,
        cast(Any, {"on_timeout": {"action": "kill", "keep_memory": None}}),
    )

    assert body["autoPause"] is False
    assert "autoPauseMemory" not in body


def test_create_treats_a_none_keep_memory_as_unconfigured(monkeypatch, test_api_key):
    # Building the option dict from a value that happens to be None is no more a
    # choice of snapshot kind than leaving the key out.
    body = _sync_request_body(
        monkeypatch,
        test_api_key,
        cast(Any, {"on_timeout": {"action": "pause", "keep_memory": None}}),
    )

    assert body["autoPause"] is True
    assert "autoPauseMemory" not in body


def test_create_allows_auto_resume_with_an_unconfigured_keep_memory(
    monkeypatch, test_api_key
):
    body = _sync_request_body(
        monkeypatch,
        test_api_key,
        cast(
            Any,
            {
                "on_timeout": {"action": "pause", "keep_memory": None},
                "auto_resume": True,
            },
        ),
    )

    assert body["autoPause"] is True
    assert "autoPauseMemory" not in body
    assert body["autoResume"] == {"enabled": True}


# `None` expects autoResume to be absent from the payload: an unconfigured
# preference is not an explicit opt-out, so the API keeps ownership of the
# default instead of receiving {"enabled": False}.
AUTO_RESUME_CASES = [
    pytest.param(None, None, id="no-lifecycle"),
    pytest.param({"on_timeout": "pause"}, None, id="only-on-timeout"),
    pytest.param(
        {"on_timeout": "pause", "auto_resume": False},
        {"enabled": False},
        id="explicit-false",
    ),
    pytest.param(
        {"on_timeout": "pause", "auto_resume": True},
        {"enabled": True},
        id="explicit-true",
    ),
    pytest.param(
        cast(Any, {"on_timeout": "pause", "auto_resume": None}),
        None,
        id="explicit-none",
    ),
]


@pytest.mark.parametrize("lifecycle, auto_resume", AUTO_RESUME_CASES)
def test_create_sends_auto_resume_only_when_configured(
    monkeypatch, test_api_key, lifecycle, auto_resume
):
    body = _sync_request_body(monkeypatch, test_api_key, lifecycle)

    if auto_resume is None:
        assert "autoResume" not in body
    else:
        assert body["autoResume"] == auto_resume


@pytest.mark.parametrize("lifecycle, auto_resume", AUTO_RESUME_CASES)
async def test_async_create_sends_auto_resume_only_when_configured(
    monkeypatch, test_api_key, lifecycle, auto_resume
):
    body = await _async_request_body(monkeypatch, test_api_key, lifecycle)

    if auto_resume is None:
        assert "autoResume" not in body
    else:
        assert body["autoResume"] == auto_resume
