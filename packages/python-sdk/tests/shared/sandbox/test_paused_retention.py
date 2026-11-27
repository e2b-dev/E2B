import json
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Dict, List
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

import e2b.sandbox_async.sandbox_api as async_sandbox_api
import e2b.sandbox_sync.sandbox_api as sync_sandbox_api
from e2b import AsyncSandbox, Sandbox
from e2b.api import ApiClient, AsyncApiClient
from e2b.api.client.api.sandboxes import post_v2_sandboxes
from e2b.api.client.models import ListedSandbox, SandboxDetail
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.exceptions import (
    InvalidArgumentException,
    SandboxException,
    SandboxNotFoundException,
)
from e2b.sandbox.sandbox_api import SandboxInfo

SANDBOX_ID = "sbx-test"
DAY = 24 * 3600


def _created_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id=SANDBOX_ID,
            template_id="template-id",
        ),
    )


def _sync_create_body(monkeypatch, api_key: str, lifecycle) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, lifecycle=lifecycle)

    return request.call_args.kwargs["body"].to_dict()


async def _async_create_body(monkeypatch, api_key: str, lifecycle) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=api_key, lifecycle=lifecycle)

    return request.call_args.kwargs["body"].to_dict()


def _mock_api(monkeypatch, status: int = 204, body=None) -> List[httpx.Request]:
    """Serve every REST call from a mock transport and record the requests, so
    the tests see the bytes that would go on the wire."""
    requests: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if body is None:
            return httpx.Response(status)
        return httpx.Response(status, json=body)

    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        sync_sandbox_api,
        "get_api_client",
        lambda config, **kwargs: ApiClient(config, transport=transport, **kwargs),
    )
    monkeypatch.setattr(
        async_sandbox_api,
        "get_api_client",
        lambda config, **kwargs: AsyncApiClient(config, transport=transport, **kwargs),
    )
    return requests


VALID_RETENTIONS = [
    pytest.param(3_600, id="1-hour"),
    pytest.param(7 * DAY, id="7-days"),
    pytest.param(3_153_600_000, id="100-years"),
]

# Below 1 hour, above 100 years, or not a whole number of seconds.
INVALID_RETENTIONS = [
    pytest.param(3_599, id="below-min"),
    pytest.param(3_153_600_001, id="above-max"),
    pytest.param(0, id="zero"),
    pytest.param(-3_600, id="negative"),
    pytest.param(3_600.5, id="fraction"),
    pytest.param(3_600.0, id="float"),
    pytest.param("3600", id="string"),
    pytest.param(True, id="bool"),
]


@pytest.mark.parametrize("paused_retention", VALID_RETENTIONS)
def test_create_sends_paused_retention(monkeypatch, test_api_key, paused_retention):
    body = _sync_create_body(
        monkeypatch,
        test_api_key,
        {"on_timeout": "pause", "paused_retention": paused_retention},
    )

    assert body["pausedRetentionSeconds"] == paused_retention
    assert body["autoPause"] is True


@pytest.mark.parametrize("paused_retention", VALID_RETENTIONS)
async def test_async_create_sends_paused_retention(
    monkeypatch, test_api_key, paused_retention
):
    body = await _async_create_body(
        monkeypatch,
        test_api_key,
        {"on_timeout": "pause", "paused_retention": paused_retention},
    )

    assert body["pausedRetentionSeconds"] == paused_retention
    assert body["autoPause"] is True


@pytest.mark.parametrize(
    "lifecycle",
    [
        pytest.param(None, id="no-lifecycle"),
        pytest.param({"on_timeout": "pause"}, id="unset"),
        pytest.param({"on_timeout": "pause", "paused_retention": None}, id="none"),
    ],
)
def test_create_omits_unset_paused_retention(monkeypatch, test_api_key, lifecycle):
    body = _sync_create_body(monkeypatch, test_api_key, lifecycle)

    assert "pausedRetentionSeconds" not in body


@pytest.mark.parametrize("paused_retention", INVALID_RETENTIONS)
def test_create_rejects_invalid_paused_retention(
    monkeypatch, test_api_key, paused_retention
):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)

    with pytest.raises(
        InvalidArgumentException, match=r'^lifecycle\["paused_retention"\] must be'
    ):
        Sandbox.create(
            api_key=test_api_key,
            lifecycle={"on_timeout": "pause", "paused_retention": paused_retention},
        )

    request.assert_not_called()


@pytest.mark.parametrize("paused_retention", INVALID_RETENTIONS)
async def test_async_create_rejects_invalid_paused_retention(
    monkeypatch, test_api_key, paused_retention
):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "asyncio_detailed", request)

    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.create(
            api_key=test_api_key,
            lifecycle={"on_timeout": "pause", "paused_retention": paused_retention},
        )

    request.assert_not_called()


SET_CASES = [
    pytest.param(DAY, {"pausedRetentionSeconds": DAY}, id="set"),
    # The removal must reach the API as an explicit null, not a missing key.
    pytest.param(None, {"pausedRetentionSeconds": None}, id="remove"),
]


@pytest.mark.parametrize("paused_retention, expected", SET_CASES)
def test_set_paused_retention(monkeypatch, test_api_key, paused_retention, expected):
    requests = _mock_api(monkeypatch)

    Sandbox.set_paused_retention(SANDBOX_ID, paused_retention, api_key=test_api_key)

    assert len(requests) == 1
    assert requests[0].method == "PUT"
    assert requests[0].url.path == f"/sandboxes/{SANDBOX_ID}/paused-retention"
    assert json.loads(requests[0].content) == expected


@pytest.mark.parametrize("paused_retention, expected", SET_CASES)
async def test_async_set_paused_retention(
    monkeypatch, test_api_key, paused_retention, expected
):
    requests = _mock_api(monkeypatch)

    await AsyncSandbox.set_paused_retention(
        SANDBOX_ID, paused_retention, api_key=test_api_key
    )

    assert len(requests) == 1
    assert requests[0].url.path == f"/sandboxes/{SANDBOX_ID}/paused-retention"
    assert json.loads(requests[0].content) == expected


def test_instance_set_paused_retention(monkeypatch, test_api_key):
    monkeypatch.setattr(
        post_v2_sandboxes, "sync_detailed", Mock(return_value=_created_sandbox())
    )
    sandbox = Sandbox.create(api_key=test_api_key)
    requests = _mock_api(monkeypatch)

    sandbox.set_paused_retention(2 * DAY)
    sandbox.set_paused_retention(None)

    assert [r.url.path for r in requests] == [
        f"/sandboxes/{SANDBOX_ID}/paused-retention"
    ] * 2
    assert [json.loads(r.content) for r in requests] == [
        {"pausedRetentionSeconds": 2 * DAY},
        {"pausedRetentionSeconds": None},
    ]


async def test_async_instance_set_paused_retention(monkeypatch, test_api_key):
    monkeypatch.setattr(
        post_v2_sandboxes,
        "asyncio_detailed",
        AsyncMock(return_value=_created_sandbox()),
    )
    sandbox = await AsyncSandbox.create(api_key=test_api_key)
    requests = _mock_api(monkeypatch)

    await sandbox.set_paused_retention(2 * DAY)
    await sandbox.set_paused_retention(None)

    assert [json.loads(r.content) for r in requests] == [
        {"pausedRetentionSeconds": 2 * DAY},
        {"pausedRetentionSeconds": None},
    ]


@pytest.mark.parametrize("paused_retention", INVALID_RETENTIONS)
def test_set_paused_retention_rejects_invalid_values(
    monkeypatch, test_api_key, paused_retention
):
    requests = _mock_api(monkeypatch)

    with pytest.raises(InvalidArgumentException, match=r"^paused_retention must be"):
        Sandbox.set_paused_retention(SANDBOX_ID, paused_retention, api_key=test_api_key)

    assert requests == []


@pytest.mark.parametrize("paused_retention", INVALID_RETENTIONS)
async def test_async_set_paused_retention_rejects_invalid_values(
    monkeypatch, test_api_key, paused_retention
):
    requests = _mock_api(monkeypatch)

    with pytest.raises(InvalidArgumentException):
        await AsyncSandbox.set_paused_retention(
            SANDBOX_ID, paused_retention, api_key=test_api_key
        )

    assert requests == []


def test_set_paused_retention_unknown_sandbox(monkeypatch, test_api_key):
    _mock_api(monkeypatch, 404, {"code": 404, "message": "sandbox not found"})

    with pytest.raises(SandboxNotFoundException):
        Sandbox.set_paused_retention(SANDBOX_ID, DAY, api_key=test_api_key)


async def test_async_set_paused_retention_changing_state(monkeypatch, test_api_key):
    _mock_api(monkeypatch, 409, {"code": 409, "message": "sandbox is pausing"})

    with pytest.raises(SandboxException) as exc:
        await AsyncSandbox.set_paused_retention(SANDBOX_ID, DAY, api_key=test_api_key)

    assert exc.value.status_code == 409


def _sandbox_data(**fields) -> Dict[str, Any]:
    return {
        "templateID": "base",
        "sandboxID": SANDBOX_ID,
        "clientID": "client",
        "startedAt": "2026-01-01T00:00:00Z",
        "endAt": "2026-01-01T01:00:00Z",
        "envdVersion": "0.2.4",
        "cpuCount": 2,
        "memoryMB": 512,
        "diskSizeMB": 1024,
        "state": "paused",
        "lifecycle": {"onTimeout": "pause", "autoResume": True},
        **fields,
    }


def test_info_reports_paused_retention_and_expiry():
    data = _sandbox_data(pausedRetentionSeconds=DAY, expiresAt="2026-01-02T01:00:00Z")

    info = SandboxInfo._from_sandbox_detail(SandboxDetail.from_dict(data))

    assert info.lifecycle == {
        "on_timeout": "pause",
        "auto_resume": True,
        "paused_retention": DAY,
    }
    assert info.paused_expires_at == datetime(2026, 1, 2, 1, tzinfo=timezone.utc)


def test_info_without_paused_retention():
    data = _sandbox_data(pausedRetentionSeconds=None, expiresAt=None)

    info = SandboxInfo._from_sandbox_detail(SandboxDetail.from_dict(data))

    assert info.lifecycle is not None
    assert info.lifecycle["paused_retention"] is None
    assert info.paused_expires_at is None


@pytest.mark.parametrize(
    "expires_at, expected",
    [
        ("2026-01-01T02:00:00Z", datetime(2026, 1, 1, 2, tzinfo=timezone.utc)),
        (None, None),
    ],
)
def test_listed_sandbox_reports_expiry(expires_at, expected):
    data = _sandbox_data(pausedRetentionSeconds=3_600, expiresAt=expires_at)

    info = SandboxInfo._from_listed_sandbox(ListedSandbox.from_dict(data))

    assert info.paused_expires_at == expected
