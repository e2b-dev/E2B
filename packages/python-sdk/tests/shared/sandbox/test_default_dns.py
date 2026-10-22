import pytest

from e2b import SandboxNetworkOpts, SandboxNetworkUpdate
from e2b.api.client.models import SandboxNetworkConfig
from e2b.sandbox.sandbox_api import (
    build_network_config,
    build_network_update_body,
    from_client_network_config,
)


def _create_wire_body(network: SandboxNetworkOpts) -> dict:
    # Same construction the sync and async create paths use.
    body = build_network_config(network)
    assert body is not None
    return SandboxNetworkConfig(**body).to_dict()


@pytest.mark.parametrize("allow_default_dns", [False, True])
def test_create_sends_allow_default_dns(allow_default_dns):
    wire = _create_wire_body(
        {
            "allow_out": ["api.example.com"],
            "deny_out": lambda ctx: [ctx.all_traffic],
            "allow_default_dns": allow_default_dns,
        }
    )

    assert wire["allowOut"] == ["api.example.com"]
    assert wire["denyOut"] == ["0.0.0.0/0"]
    assert wire["allowDefaultDns"] is allow_default_dns


def test_create_omits_allow_default_dns_when_not_provided():
    wire = _create_wire_body({"allow_out": ["api.example.com"]})

    assert "allowDefaultDns" not in wire


def test_create_leaves_out_an_empty_network_config():
    # Both create paths skip the network field when this is empty.
    assert not build_network_config({})


@pytest.mark.parametrize("allow_default_dns", [False, True])
def test_update_sends_allow_default_dns(allow_default_dns):
    network: SandboxNetworkUpdate = {
        "allow_out": ["api.example.com"],
        "allow_default_dns": allow_default_dns,
    }

    assert build_network_update_body(network).to_dict() == {
        "allowOut": ["api.example.com"],
        "allowDefaultDns": allow_default_dns,
    }


def test_update_omits_allow_default_dns_when_not_provided():
    assert build_network_update_body({"allow_out": ["api.example.com"]}).to_dict() == {
        "allowOut": ["api.example.com"],
    }


def test_get_info_reports_allow_default_dns():
    info = from_client_network_config(
        SandboxNetworkConfig.from_dict(
            {"allowOut": ["api.example.com"], "allowDefaultDns": False}
        )
    )

    assert info is not None
    assert info["allow_default_dns"] is False


def test_get_info_leaves_allow_default_dns_unset_when_the_api_omits_it():
    info = from_client_network_config(
        SandboxNetworkConfig.from_dict({"allowOut": ["api.example.com"]})
    )

    assert info is not None
    assert "allow_default_dns" not in info
