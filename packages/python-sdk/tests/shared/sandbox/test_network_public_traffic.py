from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import post_v2_sandboxes
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.api.client.models import SandboxNetworkConfig
from e2b.sandbox.sandbox_api import from_client_network_config


NETWORK_CASES = [
    pytest.param(None, None, id="omitted"),
    pytest.param({}, None, id="empty"),
    pytest.param({"allow_out": ["1.1.1.1"]}, {"allowOut": ["1.1.1.1"]}, id="egress"),
    pytest.param(
        {"allow_public_traffic": True}, {"allowPublicTraffic": True}, id="public"
    ),
    pytest.param(
        {"allow_public_traffic": False}, {"allowPublicTraffic": False}, id="private"
    ),
]


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


@pytest.mark.parametrize("network, expected", NETWORK_CASES)
def test_create_network_payload(monkeypatch, test_api_key, network, expected):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)

    Sandbox.create(api_key=test_api_key, network=network)

    body = request.call_args.kwargs["body"].to_dict()
    if expected is None:
        assert "network" not in body
    else:
        assert body["network"] == expected


@pytest.mark.parametrize("network, expected", NETWORK_CASES)
async def test_async_create_network_payload(
    monkeypatch, test_api_key, network, expected
):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "asyncio_detailed", request)

    await AsyncSandbox.create(api_key=test_api_key, network=network)

    body = request.call_args.kwargs["body"].to_dict()
    if expected is None:
        assert "network" not in body
    else:
        assert body["network"] == expected


@pytest.mark.parametrize(
    "payload, expected",
    [
        ({}, {}),
        ({"allowPublicTraffic": None}, {}),
        ({"allowPublicTraffic": True}, {"allow_public_traffic": True}),
        ({"allowPublicTraffic": False}, {"allow_public_traffic": False}),
    ],
)
def test_network_info_public_traffic(payload, expected):
    info = from_client_network_config(SandboxNetworkConfig.from_dict(payload))

    assert info == expected
