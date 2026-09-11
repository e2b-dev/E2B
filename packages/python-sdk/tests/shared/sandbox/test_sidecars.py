from types import SimpleNamespace
from typing import Any, Dict, List, cast
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import AsyncSandbox, Sandbox, SandboxInfo, SidecarInfo
from e2b.api.client.api.sandboxes import (
    post_sandboxes,
    put_sandboxes_sandbox_id_network,
)
from e2b.api.client.models import ListedSandbox, SandboxDetail
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.exceptions import (
    InvalidArgumentException,
    SandboxException,
    SandboxNotFoundException,
)
from e2b.sandbox.sandbox_api import build_sidecars_body, sidecar_api_exception

REDIS_INFO: Dict[str, Any] = {
    "entry": "redis",
    "version": "7.4.1",
    "role": "service",
    "class": "stateful",
    "state": "running",
    "name": "redis.sidecar.e2b.local",
    "address": "169.254.0.25",
    "ports": [6379],
}

FAILED_PROXY_INFO: Dict[str, Any] = {
    "entry": "iron-proxy",
    "version": "0.4.1",
    "role": "proxy",
    "class": "stateful",
    "state": "failed",
    "name": "iron-proxy.sidecar.e2b.local",
    "lastError": "readiness probe timed out",
}

SANDBOX_DETAIL: Dict[str, Any] = {
    "sandboxID": "sbx-test",
    "templateID": "template-id",
    "clientID": "client-id",
    "envdVersion": "0.2.4",
    "startedAt": "2026-01-01T00:00:00Z",
    "endAt": "2026-01-01T01:00:00Z",
    "state": "running",
    "cpuCount": 2,
    "memoryMB": 512,
    "diskSizeMB": 1024,
}


def _response(status_code: int, content: bytes = b"", parsed=None):
    return SimpleNamespace(
        status_code=status_code, content=content, headers={}, parsed=parsed
    )


def _created_sandbox():
    return _response(
        200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id="sbx-test",
            template_id="template-id",
        ),
    )


def _sync_request_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


async def _async_request_body(monkeypatch, api_key: str, **kwargs) -> Dict[str, Any]:
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=api_key, **kwargs)

    return request.call_args.kwargs["body"].to_dict()


SIDECARS: List[Any] = [
    {"entry": "redis"},
    {
        "entry": "iron-proxy",
        "version": "0.4.1",
        "config": {"allow": ["api.openai.com"]},
        "secrets": {"upstream": "${e2b.secrets.openai-key}"},
    },
]

SIDECARS_WIRE = [
    {"entry": "redis"},
    {
        "entry": "iron-proxy",
        "version": "0.4.1",
        "config": {"allow": ["api.openai.com"]},
        "secrets": {"upstream": "${e2b.secrets.openai-key}"},
    },
]


def test_create_sends_the_sidecars(monkeypatch, test_api_key):
    body = _sync_request_body(monkeypatch, test_api_key, sidecars=SIDECARS)

    assert body["sidecars"] == SIDECARS_WIRE


async def test_async_create_sends_the_sidecars(monkeypatch, test_api_key):
    body = await _async_request_body(monkeypatch, test_api_key, sidecars=SIDECARS)

    assert body["sidecars"] == SIDECARS_WIRE


@pytest.mark.parametrize(
    "kwargs",
    [
        pytest.param({}, id="not-provided"),
        pytest.param({"sidecars": None}, id="none"),
        pytest.param({"sidecars": []}, id="empty-list"),
    ],
)
def test_create_omits_sidecars_when_there_are_none(monkeypatch, test_api_key, kwargs):
    body = _sync_request_body(monkeypatch, test_api_key, **kwargs)

    assert "sidecars" not in body


async def test_async_create_omits_an_empty_sidecar_list(monkeypatch, test_api_key):
    body = await _async_request_body(monkeypatch, test_api_key, sidecars=[])

    assert "sidecars" not in body


def test_create_strips_unknown_sidecar_keys():
    # An untyped caller can copy an extra key out of a config file; the API
    # rejects unknown properties.
    body = build_sidecars_body(cast(Any, [{"entry": "redis", "image": "redis:7"}]))

    assert body is not None
    assert [s.to_dict() for s in body] == [{"entry": "redis"}]


@pytest.mark.parametrize(
    "sidecars",
    [
        pytest.param([{"version": "7.4.1"}], id="missing-entry"),
        pytest.param([{"entry": 6379}], id="non-string-entry"),
        pytest.param(["redis"], id="string-item"),
        pytest.param({"entry": "redis"}, id="dict-instead-of-list"),
        pytest.param("redis", id="string"),
    ],
)
def test_create_rejects_a_malformed_sidecar_list(monkeypatch, test_api_key, sidecars):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException, match="sidecars"):
        Sandbox.create(api_key=test_api_key, sidecars=cast(Any, sidecars))

    request.assert_not_called()


def _expected_infos() -> List[SidecarInfo]:
    return [
        SidecarInfo(
            entry="redis",
            version="7.4.1",
            role="service",
            class_="stateful",
            state="running",
            name="redis.sidecar.e2b.local",
            address="169.254.0.25",
            ports=[6379],
        ),
        SidecarInfo(
            entry="iron-proxy",
            version="0.4.1",
            role="proxy",
            class_="stateful",
            state="failed",
            name="iron-proxy.sidecar.e2b.local",
            last_error="readiness probe timed out",
        ),
    ]


def test_info_returns_the_sidecars_with_their_state():
    detail = SandboxDetail.from_dict(
        {**SANDBOX_DETAIL, "sidecars": [REDIS_INFO, FAILED_PROXY_INFO]}
    )

    info = SandboxInfo._from_sandbox_detail(detail)

    assert info.sidecars == _expected_infos()


def test_info_passes_through_a_state_value_the_sdk_does_not_know():
    detail = SandboxDetail.from_dict(
        {**SANDBOX_DETAIL, "sidecars": [{**REDIS_INFO, "state": "restarting"}]}
    )

    info = SandboxInfo._from_sandbox_detail(detail)

    assert info.sidecars[0].state == "restarting"


def test_info_returns_an_empty_sidecar_list_when_the_api_sends_none():
    info = SandboxInfo._from_sandbox_detail(SandboxDetail.from_dict(SANDBOX_DETAIL))

    assert info.sidecars == []


def test_list_returns_the_sidecars_of_each_sandbox():
    listed = ListedSandbox.from_dict({**SANDBOX_DETAIL, "sidecars": [REDIS_INFO]})

    info = SandboxInfo._from_listed_sandbox(listed)

    assert info.sidecars == _expected_infos()[:1]


def test_a_sidecar_400_is_an_argument_error_with_the_code_preserved(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            400,
            b'{"code":400,"error_code":"sidecar_unknown_entry",'
            b'"message":"unknown sidecar entry \\"memcached\\""}',
        )
    )
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException) as excinfo:
        Sandbox.create(api_key=test_api_key, sidecars=[{"entry": "memcached"}])

    assert excinfo.value.status_code == 400
    assert "sidecar_unknown_entry" in str(excinfo.value)
    assert "memcached" in str(excinfo.value)


async def test_async_sidecar_400_is_an_argument_error(monkeypatch, test_api_key):
    request = AsyncMock(
        return_value=_response(
            400, b'{"code":400,"error_code":"sidecar_flag_off","message":"off"}'
        )
    )
    monkeypatch.setattr(post_sandboxes, "asyncio_detailed", request)

    with pytest.raises(InvalidArgumentException, match="sidecar_flag_off"):
        await AsyncSandbox.create(api_key=test_api_key, sidecars=[{"entry": "redis"}])


def test_sidecar_failed_keeps_the_entry_name_and_is_not_an_argument_error(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            500,
            b'{"code":500,"error_code":"sidecar_failed",'
            b'"message":"sidecar \\"redis\\" failed to become ready"}',
        )
    )
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    with pytest.raises(SandboxException) as excinfo:
        Sandbox.create(api_key=test_api_key, sidecars=[{"entry": "redis"}])

    assert not isinstance(excinfo.value, InvalidArgumentException)
    assert excinfo.value.status_code == 500
    assert "sidecar_failed" in str(excinfo.value)
    assert "redis" in str(excinfo.value)


@pytest.mark.parametrize(
    "code",
    [
        "sidecar_unknown_entry",
        "sidecar_deprecated_entry",
        "sidecar_limit",
        "sidecar_one_proxy",
        "sidecar_config_invalid",
        "sidecar_secret_missing",
        "sidecar_rule_collision",
        "sidecar_egress_conflict",
        "sidecar_flag_off",
    ],
)
def test_every_400_sidecar_code_is_an_argument_error(code):
    err = sidecar_api_exception(
        _response(
            400, f'{{"code":400,"error_code":"{code}","message":"rejected"}}'.encode()
        )
    )

    assert isinstance(err, InvalidArgumentException)
    assert err.status_code == 400
    assert str(err) == f"{code}: rejected"


@pytest.mark.parametrize(
    "content",
    [
        pytest.param(b'{"code":400,"message":"invalid template"}', id="no-code"),
        pytest.param(b'{"error_code":"sandbox_create_failed"}', id="other-code"),
        pytest.param(b'{"error_code":"SIDECAR_UNKNOWN_ENTRY"}', id="uppercase"),
        pytest.param(b"not json", id="not-json"),
        pytest.param(b"", id="empty"),
        pytest.param(b"[1]", id="not-an-object"),
        pytest.param(b"\xff\xfe{", id="not-utf8"),
    ],
)
def test_other_errors_keep_the_generic_mapping(content):
    assert sidecar_api_exception(_response(400, content)) is None


def test_update_network_surfaces_a_rule_collision_as_an_argument_error(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            400,
            b'{"code":400,"error_code":"sidecar_rule_collision",'
            b'"message":"api.openai.com is routed through the iron-proxy sidecar"}',
        )
    )
    monkeypatch.setattr(put_sandboxes_sandbox_id_network, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException, match="sidecar_rule_collision"):
        Sandbox.update_network(
            "sbx-test", {"allow_out": ["api.openai.com"]}, api_key=test_api_key
        )


def test_update_network_404_still_wins_over_the_sidecar_mapping(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            404, b'{"code":404,"error_code":"sidecar_x","message":"gone"}'
        )
    )
    monkeypatch.setattr(put_sandboxes_sandbox_id_network, "sync_detailed", request)

    with pytest.raises(SandboxNotFoundException):
        Sandbox.update_network("sbx-test", {}, api_key=test_api_key)
