import logging
from types import SimpleNamespace
from typing import Any, Dict, List, cast
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from dateutil.parser import isoparse

from e2b import (
    AsyncSandbox,
    Sandbox,
    SandboxInfo,
    SidecarInfo,
    SidecarStateInfo,
    SidecarStateVersionInfo,
)
from e2b.api.client.api.sandboxes import (
    delete_sidecar_states_name,
    delete_sidecar_states_name_versions_version,
    get_sidecar_states,
    get_sidecar_states_name,
    post_sandboxes,
    post_sandboxes_sandbox_id_connect,
    post_sandboxes_sandbox_id_sidecars_entry_state,
    put_sandboxes_sandbox_id_network,
)
from e2b.api.client.models import (
    ListedSandbox,
    SandboxDetail,
    SidecarState,
    SidecarStateDetail,
    SidecarStateVersion,
)
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import (
    InvalidArgumentException,
    NotFoundException,
    SandboxException,
    SandboxNotFoundException,
)
from e2b.sandbox.sandbox_api import build_sidecars_body, sidecar_api_exception

VALKEY_INFO: Dict[str, Any] = {
    "entry": "valkey",
    "version": "7.4.1",
    "role": "service",
    "class": "stateful",
    "state": "running",
    "name": "valkey.sidecar.e2b.local",
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
    {"entry": "valkey"},
    {
        "entry": "iron-proxy",
        "version": "0.4.1",
        "config": {"allow": ["api.openai.com"]},
        "secrets": {"upstream": "${e2b.secrets.openai-key}"},
    },
]

SIDECARS_WIRE = [
    {"entry": "valkey"},
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
    body = build_sidecars_body(cast(Any, [{"entry": "valkey", "image": "valkey:7"}]))

    assert body is not None
    assert [s.to_dict() for s in body] == [{"entry": "valkey"}]


@pytest.mark.parametrize(
    "sidecars",
    [
        pytest.param([{"version": "7.4.1"}], id="missing-entry"),
        pytest.param([{"entry": 6379}], id="non-string-entry"),
        pytest.param(["valkey"], id="string-item"),
        pytest.param({"entry": "valkey"}, id="dict-instead-of-list"),
        pytest.param("valkey", id="string"),
    ],
)
def test_create_rejects_a_malformed_sidecar_list(monkeypatch, test_api_key, sidecars):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException, match="sidecars"):
        Sandbox.create(api_key=test_api_key, sidecars=cast(Any, sidecars))

    request.assert_not_called()


@pytest.mark.parametrize(
    "sidecar, field",
    [
        pytest.param(
            {"entry": "valkey", "config": ["maxmemory"]}, "config", id="config-list"
        ),
        pytest.param(
            {"entry": "valkey", "config": "maxmemory=64mb"}, "config", id="config-str"
        ),
        pytest.param(
            {"entry": "iron-proxy", "secrets": ["upstream"]},
            "secrets",
            id="secrets-list",
        ),
        pytest.param(
            {"entry": "iron-proxy", "secrets": {"upstream": 1}},
            "secrets",
            id="secrets-non-str-value",
        ),
        pytest.param(
            {"entry": "iron-proxy", "secrets": {1: "x"}},
            "secrets",
            id="secrets-non-str-key",
        ),
    ],
)
def test_create_rejects_a_malformed_sidecar_config_or_secrets_by_name(sidecar, field):
    # dict() on a bad value used to escape as a bare ValueError that named nothing.
    with pytest.raises(InvalidArgumentException, match=rf"sidecars\[0\]\.{field}"):
        build_sidecars_body(cast(Any, [sidecar]))


def _expected_infos() -> List[SidecarInfo]:
    return [
        SidecarInfo(
            entry="valkey",
            version="7.4.1",
            role="service",
            class_="stateful",
            state="running",
            name="valkey.sidecar.e2b.local",
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
        {**SANDBOX_DETAIL, "sidecars": [VALKEY_INFO, FAILED_PROXY_INFO]}
    )

    info = SandboxInfo._from_sandbox_detail(detail)

    assert info.sidecars == _expected_infos()


def test_info_passes_through_a_state_value_the_sdk_does_not_know():
    detail = SandboxDetail.from_dict(
        {**SANDBOX_DETAIL, "sidecars": [{**VALKEY_INFO, "state": "restarting"}]}
    )

    info = SandboxInfo._from_sandbox_detail(detail)

    assert info.sidecars[0].state == "restarting"


def test_info_treats_null_optional_fields_as_absent():
    # A wire `null` is neither Unset nor a value; it must not raise inside get_info()/list().
    detail = SandboxDetail.from_dict(
        {
            **SANDBOX_DETAIL,
            "sidecars": [
                {**VALKEY_INFO, "ports": None, "address": None, "lastError": None}
            ],
        }
    )

    [info] = SandboxInfo._from_sandbox_detail(detail).sidecars

    assert info.ports == []
    assert info.address is None
    assert info.last_error is None


def test_info_returns_an_empty_sidecar_list_when_the_api_sends_none():
    info = SandboxInfo._from_sandbox_detail(SandboxDetail.from_dict(SANDBOX_DETAIL))

    assert info.sidecars == []


def test_list_returns_the_sidecars_of_each_sandbox():
    listed = ListedSandbox.from_dict({**SANDBOX_DETAIL, "sidecars": [VALKEY_INFO]})

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
        await AsyncSandbox.create(api_key=test_api_key, sidecars=[{"entry": "valkey"}])


def test_sidecar_failed_keeps_the_entry_name_and_is_not_an_argument_error(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            500,
            b'{"code":500,"error_code":"sidecar_failed",'
            b'"message":"sidecar \\"valkey\\" failed to become ready"}',
        )
    )
    monkeypatch.setattr(post_sandboxes, "sync_detailed", request)

    with pytest.raises(SandboxException) as excinfo:
        Sandbox.create(api_key=test_api_key, sidecars=[{"entry": "valkey"}])

    assert not isinstance(excinfo.value, InvalidArgumentException)
    assert excinfo.value.status_code == 500
    assert "sidecar_failed" in str(excinfo.value)
    assert "valkey" in str(excinfo.value)


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


@pytest.mark.parametrize(
    "code, status",
    [
        ("sidecar_version_unavailable", 409),
        ("sidecar_snapshot_mismatch", 500),
    ],
)
def test_resume_codes_stay_sandbox_exceptions_with_the_code_and_status(code, status):
    err = sidecar_api_exception(
        _response(
            status,
            f'{{"code":{status},"error_code":"{code}","message":"resume"}}'.encode(),
        )
    )

    assert isinstance(err, SandboxException)
    assert not isinstance(err, InvalidArgumentException)
    assert err.status_code == status
    assert str(err) == f"{code}: resume"


def test_connect_surfaces_a_sidecar_version_unavailable_conflict(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            409,
            b'{"code":409,"error_code":"sidecar_version_unavailable",'
            b'"message":"catalog version valkey@7.4.0 is no longer available"}',
        )
    )
    monkeypatch.setattr(post_sandboxes_sandbox_id_connect, "sync_detailed", request)

    with pytest.raises(SandboxException) as excinfo:
        Sandbox.connect("sbx-test", api_key=test_api_key)

    assert not isinstance(excinfo.value, InvalidArgumentException)
    assert excinfo.value.status_code == 409
    assert "sidecar_version_unavailable" in str(excinfo.value)
    assert "valkey@7.4.0" in str(excinfo.value)


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


def _create_response():
    return SimpleNamespace(
        sandbox_id="sbx-test",
        sandbox_domain=None,
        envd_version="0.2.4",
        envd_access_token=None,
        traffic_access_token=None,
    )


def test_create_keeps_logger_positional_and_sidecars_keyword_only(
    monkeypatch, test_api_key
):
    from e2b.sandbox_sync.sandbox_api import SandboxApi

    create_sandbox = Mock(return_value=_create_response())
    monkeypatch.setattr(SandboxApi, "_create_sandbox", create_sandbox)
    logger = logging.getLogger("sidecar-test")

    # The twelve positional parameters create() had before sidecars existed.
    Sandbox.create(
        "template-id",
        60,
        None,
        None,
        True,
        True,
        None,
        None,
        None,
        None,
        None,
        logger,
        api_key=test_api_key,
    )

    assert create_sandbox.call_args.kwargs["logger"] is logger
    assert create_sandbox.call_args.kwargs["sidecars"] is None

    Sandbox.create(api_key=test_api_key, sidecars=[{"entry": "valkey"}])
    assert create_sandbox.call_args.kwargs["sidecars"] == [{"entry": "valkey"}]

    # cast: the extra positional argument is the point; ty would reject it statically.
    with pytest.raises(TypeError):
        cast(Any, Sandbox.create)(
            "template-id",
            60,
            None,
            None,
            True,
            True,
            None,
            None,
            None,
            None,
            None,
            logger,
            [{"entry": "valkey"}],
            api_key=test_api_key,
        )


async def test_async_create_keeps_logger_positional_and_sidecars_keyword_only(
    monkeypatch, test_api_key
):
    from e2b.sandbox_async.sandbox_api import SandboxApi

    create_sandbox = AsyncMock(return_value=_create_response())
    monkeypatch.setattr(SandboxApi, "_create_sandbox", create_sandbox)
    logger = logging.getLogger("sidecar-test")

    await AsyncSandbox.create(
        "template-id",
        60,
        None,
        None,
        True,
        True,
        None,
        None,
        None,
        None,
        None,
        logger,
        api_key=test_api_key,
    )

    assert create_sandbox.call_args.kwargs["logger"] is logger
    assert create_sandbox.call_args.kwargs["sidecars"] is None

    with pytest.raises(TypeError):
        await cast(Any, AsyncSandbox.create)(
            "template-id",
            60,
            None,
            None,
            True,
            True,
            None,
            None,
            None,
            None,
            None,
            logger,
            [{"entry": "valkey"}],
            api_key=test_api_key,
        )


STATE_VERSION_WIRE: Dict[str, Any] = {
    "name": "project-db",
    "entry": "sqlite",
    "version": 2,
    "entryVersion": "0.24.32",
    "sizeBytes": 4194304,
    "sourceSandboxID": "sbx-test",
    "createdAt": "2026-09-20T10:00:00Z",
}

STATE_WIRE: Dict[str, Any] = {
    "name": "project-db",
    "entry": "sqlite",
    "sizeMiB": 512,
    "latestVersion": 2,
    "versionCount": 2,
    "createdAt": "2026-09-19T09:00:00Z",
    "updatedAt": "2026-09-20T10:00:00Z",
}


def _expected_version() -> "SidecarStateVersionInfo":
    return SidecarStateVersionInfo(
        name="project-db",
        entry="sqlite",
        version=2,
        entry_version="0.24.32",
        size_bytes=4194304,
        source_sandbox_id="sbx-test",
        created_at=isoparse("2026-09-20T10:00:00Z"),
    )


def _expected_state(versions=None) -> "SidecarStateInfo":
    return SidecarStateInfo(
        name="project-db",
        entry="sqlite",
        size_mib=512,
        latest_version=2,
        version_count=2,
        created_at=isoparse("2026-09-19T09:00:00Z"),
        updated_at=isoparse("2026-09-20T10:00:00Z"),
        versions=versions or [],
    )


SIDECARS_WITH_STATE: List[Any] = [
    {"entry": "sqlite", "state": "project-db"},
    {"entry": "valkey", "state": "warm-cache", "state_version": 3},
]

SIDECARS_WITH_STATE_WIRE = [
    {"entry": "sqlite", "state": "project-db"},
    {"entry": "valkey", "state": "warm-cache", "stateVersion": 3},
]


def test_create_sends_the_attached_state(monkeypatch, test_api_key):
    body = _sync_request_body(monkeypatch, test_api_key, sidecars=SIDECARS_WITH_STATE)

    assert body["sidecars"] == SIDECARS_WITH_STATE_WIRE


async def test_async_create_sends_the_attached_state(monkeypatch, test_api_key):
    body = await _async_request_body(
        monkeypatch, test_api_key, sidecars=SIDECARS_WITH_STATE
    )

    assert body["sidecars"] == SIDECARS_WITH_STATE_WIRE


def test_info_reports_the_state_a_sidecar_was_attached_from():
    detail = SandboxDetail.from_dict(
        {
            **SANDBOX_DETAIL,
            "sidecars": [{**VALKEY_INFO, "stateName": "warm-cache", "stateVersion": 3}],
        }
    )

    [info] = SandboxInfo._from_sandbox_detail(detail).sidecars

    assert info.state_name == "warm-cache"
    assert info.state_version == 3


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({}, id="absent"),
        pytest.param({"stateName": None, "stateVersion": None}, id="null"),
    ],
)
def test_info_has_no_state_when_the_sidecar_was_not_attached_from_one(overrides):
    detail = SandboxDetail.from_dict(
        {**SANDBOX_DETAIL, "sidecars": [{**VALKEY_INFO, **overrides}]}
    )

    [info] = SandboxInfo._from_sandbox_detail(detail).sidecars

    assert info.state_name is None
    assert info.state_version is None


def test_save_sidecar_state_posts_the_name_to_the_entry(monkeypatch, test_api_key):
    request = Mock(
        return_value=_response(
            201, parsed=SidecarStateVersion.from_dict(STATE_VERSION_WIRE)
        )
    )
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_sidecars_entry_state, "sync_detailed", request
    )

    version = Sandbox.save_sidecar_state(
        "sbx-test", "sqlite", "project-db", api_key=test_api_key
    )

    assert request.call_args.args[:2] == ("sbx-test", "sqlite")
    assert request.call_args.kwargs["body"].to_dict() == {"name": "project-db"}
    assert version == _expected_version()


async def test_async_save_sidecar_state_posts_the_name_to_the_entry(
    monkeypatch, test_api_key
):
    request = AsyncMock(
        return_value=_response(
            201, parsed=SidecarStateVersion.from_dict(STATE_VERSION_WIRE)
        )
    )
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_sidecars_entry_state, "asyncio_detailed", request
    )

    version = await AsyncSandbox.save_sidecar_state(
        "sbx-test", "sqlite", "project-db", api_key=test_api_key
    )

    assert request.call_args.args[:2] == ("sbx-test", "sqlite")
    assert version == _expected_version()


def test_save_sidecar_state_on_an_instance_uses_its_own_id(monkeypatch, test_api_key):
    request = Mock(
        return_value=_response(
            201, parsed=SidecarStateVersion.from_dict(STATE_VERSION_WIRE)
        )
    )
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_sidecars_entry_state, "sync_detailed", request
    )
    sandbox = Sandbox.__new__(Sandbox)
    monkeypatch.setattr(
        type(sandbox), "sandbox_id", property(lambda self: "sbx-instance")
    )
    sandbox._SandboxBase__connection_config = ConnectionConfig(api_key=test_api_key)

    version = sandbox.save_sidecar_state("sqlite", "project-db")

    assert request.call_args.args[:2] == ("sbx-instance", "sqlite")
    assert version.version == 2


@pytest.mark.parametrize(
    "entry, name",
    [
        pytest.param("", "project-db", id="empty-entry"),
        pytest.param("sqlite", "", id="empty-name"),
    ],
)
def test_save_sidecar_state_rejects_an_empty_entry_or_name(
    monkeypatch, test_api_key, entry, name
):
    request = Mock()
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_sidecars_entry_state, "sync_detailed", request
    )

    with pytest.raises(InvalidArgumentException):
        Sandbox.save_sidecar_state("sbx-test", entry, name, api_key=test_api_key)

    request.assert_not_called()


def test_list_sidecar_states_returns_the_team_states(monkeypatch, test_api_key):
    request = Mock(
        return_value=_response(200, parsed=[SidecarState.from_dict(STATE_WIRE)])
    )
    monkeypatch.setattr(get_sidecar_states, "sync_detailed", request)

    assert Sandbox.list_sidecar_states(api_key=test_api_key) == [_expected_state()]


async def test_async_list_sidecar_states_returns_the_team_states(
    monkeypatch, test_api_key
):
    request = AsyncMock(
        return_value=_response(200, parsed=[SidecarState.from_dict(STATE_WIRE)])
    )
    monkeypatch.setattr(get_sidecar_states, "asyncio_detailed", request)

    assert await AsyncSandbox.list_sidecar_states(api_key=test_api_key) == [
        _expected_state()
    ]


def test_get_sidecar_state_returns_the_state_with_its_versions(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            200,
            parsed=SidecarStateDetail.from_dict(
                {**STATE_WIRE, "versions": [STATE_VERSION_WIRE]}
            ),
        )
    )
    monkeypatch.setattr(get_sidecar_states_name, "sync_detailed", request)

    state = Sandbox.get_sidecar_state("project-db", api_key=test_api_key)

    assert request.call_args.args[0] == "project-db"
    assert state == _expected_state(versions=[_expected_version()])


async def test_async_get_sidecar_state_returns_the_state_with_its_versions(
    monkeypatch, test_api_key
):
    request = AsyncMock(
        return_value=_response(
            200,
            parsed=SidecarStateDetail.from_dict(
                {**STATE_WIRE, "versions": [STATE_VERSION_WIRE]}
            ),
        )
    )
    monkeypatch.setattr(get_sidecar_states_name, "asyncio_detailed", request)

    state = await AsyncSandbox.get_sidecar_state("project-db", api_key=test_api_key)

    assert state.versions == [_expected_version()]


def test_delete_sidecar_state_deletes_the_name_or_one_version(
    monkeypatch, test_api_key
):
    delete_name = Mock(return_value=_response(204))
    delete_version = Mock(return_value=_response(204))
    monkeypatch.setattr(delete_sidecar_states_name, "sync_detailed", delete_name)
    monkeypatch.setattr(
        delete_sidecar_states_name_versions_version, "sync_detailed", delete_version
    )

    Sandbox.delete_sidecar_state("project-db", api_key=test_api_key)
    assert delete_name.call_args.args[0] == "project-db"
    delete_version.assert_not_called()

    Sandbox.delete_sidecar_state("project-db", version=1, api_key=test_api_key)
    assert delete_version.call_args.args[:2] == ("project-db", 1)


async def test_async_delete_sidecar_state_deletes_one_version(
    monkeypatch, test_api_key
):
    delete_version = AsyncMock(return_value=_response(204))
    monkeypatch.setattr(
        delete_sidecar_states_name_versions_version, "asyncio_detailed", delete_version
    )

    await AsyncSandbox.delete_sidecar_state(
        "project-db", version=1, api_key=test_api_key
    )

    assert delete_version.call_args.args[:2] == ("project-db", 1)


def test_a_state_name_with_a_path_separator_is_encoded(monkeypatch, test_api_key):
    delete_name = Mock(return_value=_response(204))
    monkeypatch.setattr(delete_sidecar_states_name, "sync_detailed", delete_name)

    Sandbox.delete_sidecar_state("a/../b", api_key=test_api_key)

    assert delete_name.call_args.args[0] == "a%2F..%2Fb"


@pytest.mark.parametrize(
    "code",
    [
        "sidecar_state_flag_off",
        "sidecar_state_name_invalid",
        "sidecar_state_unknown",
        "sidecar_state_version_unknown",
        "sidecar_state_entry_mismatch",
        "sidecar_state_size_mismatch",
        "sidecar_state_unsupported",
        "sidecar_state_limit",
    ],
)
def test_every_400_sidecar_state_code_is_an_argument_error(code):
    err = sidecar_api_exception(
        _response(
            400, f'{{"code":400,"error_code":"{code}","message":"rejected"}}'.encode()
        )
    )

    assert isinstance(err, InvalidArgumentException)
    assert err.status_code == 400
    assert str(err) == f"{code}: rejected"


@pytest.mark.parametrize(
    "code, status",
    [
        ("sidecar_not_running", 409),
        ("sidecar_state_busy", 409),
        ("sidecar_state_failed", 500),
    ],
)
def test_save_codes_stay_sandbox_exceptions(code, status):
    err = sidecar_api_exception(
        _response(
            status,
            f'{{"code":{status},"error_code":"{code}","message":"refused"}}'.encode(),
        )
    )

    assert isinstance(err, SandboxException)
    assert not isinstance(err, InvalidArgumentException)
    assert not isinstance(err, NotFoundException)
    assert err.status_code == status
    assert str(err) == f"{code}: refused"


@pytest.mark.parametrize(
    "code", ["sidecar_state_unknown", "sidecar_state_version_unknown"]
)
def test_a_404_on_the_state_endpoints_is_a_not_found_exception(code):
    err = sidecar_api_exception(
        _response(
            404, f'{{"code":404,"error_code":"{code}","message":"gone"}}'.encode()
        )
    )

    assert isinstance(err, NotFoundException)
    assert err.status_code == 404
    assert str(err) == f"{code}: gone"


def test_get_sidecar_state_raises_not_found_for_an_unknown_name(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            404,
            b'{"code":404,"error_code":"sidecar_state_unknown",'
            b'"message":"sidecar state \\"nope\\" not found"}',
        )
    )
    monkeypatch.setattr(get_sidecar_states_name, "sync_detailed", request)

    with pytest.raises(NotFoundException, match="sidecar_state_unknown"):
        Sandbox.get_sidecar_state("nope", api_key=test_api_key)


def test_delete_sidecar_state_raises_not_found_for_an_unknown_version(
    monkeypatch, test_api_key
):
    request = Mock(
        return_value=_response(
            404,
            b'{"code":404,"error_code":"sidecar_state_version_unknown",'
            b'"message":"version 9 not found"}',
        )
    )
    monkeypatch.setattr(
        delete_sidecar_states_name_versions_version, "sync_detailed", request
    )

    with pytest.raises(NotFoundException, match="sidecar_state_version_unknown"):
        Sandbox.delete_sidecar_state("project-db", version=9, api_key=test_api_key)


def test_save_sidecar_state_surfaces_a_busy_save(monkeypatch, test_api_key):
    request = Mock(
        return_value=_response(
            409,
            b'{"code":409,"error_code":"sidecar_state_busy",'
            b'"message":"a save for sqlite is already in flight"}',
        )
    )
    monkeypatch.setattr(
        post_sandboxes_sandbox_id_sidecars_entry_state, "sync_detailed", request
    )

    with pytest.raises(SandboxException) as excinfo:
        Sandbox.save_sidecar_state(
            "sbx-test", "sqlite", "project-db", api_key=test_api_key
        )

    assert not isinstance(excinfo.value, InvalidArgumentException)
    assert excinfo.value.status_code == 409
    assert "sidecar_state_busy" in str(excinfo.value)


def test_list_sidecar_states_surfaces_the_flag_being_off(monkeypatch, test_api_key):
    request = Mock(
        return_value=_response(
            400,
            b'{"code":400,"error_code":"sidecar_state_flag_off",'
            b'"message":"the team does not have sandbox-sidecar-states"}',
        )
    )
    monkeypatch.setattr(get_sidecar_states, "sync_detailed", request)

    with pytest.raises(InvalidArgumentException, match="sidecar_state_flag_off"):
        Sandbox.list_sidecar_states(api_key=test_api_key)


@pytest.mark.parametrize(
    "version",
    [
        pytest.param("..", id="parent-segment"),
        pytest.param("../../warm-cache", id="another-state"),
        pytest.param("1", id="numeric-string"),
        pytest.param(1.5, id="float"),
        pytest.param(0, id="zero"),
        pytest.param(-1, id="negative"),
        pytest.param(True, id="bool"),
    ],
)
def test_delete_sidecar_state_rejects_a_version_that_is_not_a_positive_int(
    monkeypatch, test_api_key, version
):
    delete_name = Mock(return_value=_response(204))
    delete_version = Mock(return_value=_response(204))
    monkeypatch.setattr(delete_sidecar_states_name, "sync_detailed", delete_name)
    monkeypatch.setattr(
        delete_sidecar_states_name_versions_version, "sync_detailed", delete_version
    )

    with pytest.raises(InvalidArgumentException, match="positive integer"):
        Sandbox.delete_sidecar_state(
            "project-db", version=cast(Any, version), api_key=test_api_key
        )

    delete_name.assert_not_called()
    delete_version.assert_not_called()


async def test_async_delete_sidecar_state_rejects_a_path_traversing_version(
    monkeypatch, test_api_key
):
    delete_version = AsyncMock(return_value=_response(204))
    monkeypatch.setattr(
        delete_sidecar_states_name_versions_version, "asyncio_detailed", delete_version
    )

    with pytest.raises(InvalidArgumentException, match="positive integer"):
        await AsyncSandbox.delete_sidecar_state(
            "project-db", version=cast(Any, ".."), api_key=test_api_key
        )

    delete_version.assert_not_called()


def test_a_traversing_version_would_have_widened_the_delete():
    """The blast radius the check above prevents, at the layer httpx builds."""
    client = httpx.Client(base_url="https://api.e2b.dev")

    widened = client.build_request("delete", "/sidecar-states/project-db/versions/..")
    retargeted = client.build_request(
        "delete", "/sidecar-states/project-db/versions/../../warm-cache"
    )

    assert widened.url.path == "/sidecar-states/project-db"
    assert retargeted.url.path == "/sidecar-states/warm-cache"


@pytest.mark.parametrize("name", ["", None, 5])
def test_the_state_endpoints_reject_a_name_that_is_not_a_non_empty_string(
    monkeypatch, test_api_key, name
):
    get_state = Mock(return_value=_response(200))
    delete_name = Mock(return_value=_response(204))
    monkeypatch.setattr(get_sidecar_states_name, "sync_detailed", get_state)
    monkeypatch.setattr(delete_sidecar_states_name, "sync_detailed", delete_name)

    with pytest.raises(InvalidArgumentException, match="non-empty"):
        Sandbox.get_sidecar_state(cast(Any, name), api_key=test_api_key)
    with pytest.raises(InvalidArgumentException, match="non-empty"):
        Sandbox.delete_sidecar_state(cast(Any, name), api_key=test_api_key)

    get_state.assert_not_called()
    delete_name.assert_not_called()


async def test_the_async_state_endpoints_reject_an_empty_name(
    monkeypatch, test_api_key
):
    get_state = AsyncMock(return_value=_response(200))
    delete_name = AsyncMock(return_value=_response(204))
    monkeypatch.setattr(get_sidecar_states_name, "asyncio_detailed", get_state)
    monkeypatch.setattr(delete_sidecar_states_name, "asyncio_detailed", delete_name)

    with pytest.raises(InvalidArgumentException, match="non-empty"):
        await AsyncSandbox.get_sidecar_state("", api_key=test_api_key)
    with pytest.raises(InvalidArgumentException, match="non-empty"):
        await AsyncSandbox.delete_sidecar_state("", api_key=test_api_key)

    get_state.assert_not_called()
    delete_name.assert_not_called()
