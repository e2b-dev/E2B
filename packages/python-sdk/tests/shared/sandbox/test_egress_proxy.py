from typing import Any, cast

import pytest

from e2b import SandboxNetworkOpts, SandboxNetworkUpdate
from e2b.api.client.models import SandboxNetworkConfig
from e2b.api.client.models import (
    SandboxEgressProxyConfigType0 as ClientSandboxEgressProxyConfig,
)
from e2b.api.client.types import UNSET
from e2b.sandbox.sandbox_api import (
    build_network_config,
    build_network_update_body,
    from_client_network_config,
)


def test_create_sends_the_egress_proxy():
    network: SandboxNetworkOpts = {
        "egress_proxy": {
            "address": "proxy.example.com:1080",
            "username": "proxy-user",
            "password": "proxy-password",
        },
    }

    body = build_network_config(network)
    assert body is not None
    assert body["egress_proxy"].to_dict() == {
        "address": "proxy.example.com:1080",
        "username": "proxy-user",
        "password": "proxy-password",
    }


def test_create_sends_an_address_only_egress_proxy():
    body = build_network_config({"egress_proxy": {"address": "proxy.example.com:1080"}})
    assert body is not None
    assert body["egress_proxy"].to_dict() == {"address": "proxy.example.com:1080"}


def test_create_combines_the_egress_proxy_with_allow_and_deny_lists():
    network: SandboxNetworkOpts = {
        "allow_out": ["api.example.com"],
        "deny_out": lambda ctx: [ctx.all_traffic],
        "egress_proxy": {"address": "proxy.example.com:1080"},
    }

    body = build_network_config(network)
    assert body is not None
    assert body["allow_out"] == ["api.example.com"]
    assert body["deny_out"] == ["0.0.0.0/0"]
    assert body["egress_proxy"].to_dict() == {"address": "proxy.example.com:1080"}


@pytest.mark.parametrize(
    "network",
    [
        pytest.param({"allow_out": ["api.example.com"]}, id="omitted"),
        # Untyped callers spell "no proxy" as None; the JS SDK treats an
        # explicit null the same way.
        pytest.param({"egress_proxy": None}, id="none"),
    ],
)
def test_create_omits_the_egress_proxy(network):
    body = build_network_config(cast(Any, network))
    assert body is not None
    assert "egress_proxy" not in body


def test_create_strips_unknown_egress_proxy_keys():
    # An untyped caller can copy an extra key out of a config file; the API
    # rejects unknown properties.
    network = cast(
        Any,
        {
            "egress_proxy": {
                "address": "proxy.example.com:1080",
                "protocol": "socks5",
            },
        },
    )

    body = build_network_config(network)
    assert body is not None
    assert body["egress_proxy"].to_dict() == {"address": "proxy.example.com:1080"}


def test_update_sets_the_egress_proxy():
    network: SandboxNetworkUpdate = {
        "allow_out": ["api.example.com"],
        "deny_out": lambda ctx: [ctx.all_traffic],
        "egress_proxy": {"address": "proxy.example.com:1080"},
    }

    assert build_network_update_body(network).to_dict() == {
        "allowOut": ["api.example.com"],
        "denyOut": ["0.0.0.0/0"],
        "egressProxy": {"address": "proxy.example.com:1080"},
    }


def test_update_without_the_egress_proxy_clears_it():
    # The update replaces the whole configuration instead of merging into it, so
    # omitting the proxy stops tunneling rather than leaving it in place.
    assert build_network_update_body({}).to_dict() == {}


def test_get_info_reports_the_active_egress_proxy_without_the_password():
    info = from_client_network_config(
        SandboxNetworkConfig(
            allow_out=["api.example.com"],
            egress_proxy=ClientSandboxEgressProxyConfig(
                address="proxy.example.com:1080",
                username="proxy-user",
                # SandboxEgressProxyInfo says the password is not there, so it
                # must not be there even if a future API version starts echoing
                # it back.
                password="proxy-password",
            ),
        )
    )

    assert info is not None
    assert info["egress_proxy"] == {
        "address": "proxy.example.com:1080",
        "username": "proxy-user",
    }


@pytest.mark.parametrize(
    "egress_proxy",
    [
        pytest.param(UNSET, id="unset"),
        # The wire field is nullable; absence has to read the same either way.
        pytest.param(None, id="none"),
    ],
)
def test_get_info_reports_no_egress_proxy(egress_proxy):
    info = from_client_network_config(
        SandboxNetworkConfig(allow_out=["api.example.com"], egress_proxy=egress_proxy)
    )

    assert info is not None
    assert "egress_proxy" not in info
