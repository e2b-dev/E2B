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


@pytest.mark.parametrize(
    "dns_servers",
    [[], ["1.1.1.1"], ["1.1.1.1", "2606:4700:4700::1111"]],
)
def test_create_sends_dns_servers(dns_servers):
    wire = _create_wire_body(
        {
            "allow_out": ["api.example.com"],
            "deny_out": lambda ctx: [ctx.all_traffic],
            "dns_servers": dns_servers,
        }
    )

    assert wire["allowOut"] == ["api.example.com"]
    assert wire["denyOut"] == ["0.0.0.0/0"]
    assert wire["dnsServers"] == dns_servers


def test_create_omits_dns_servers_when_not_provided():
    wire = _create_wire_body({"allow_out": ["api.example.com"]})

    assert wire["allowOut"] == ["api.example.com"]
    assert "dnsServers" not in wire


def test_create_treats_none_as_not_set():
    wire = _create_wire_body(
        {"allow_out": ["api.example.com"], "dns_servers": None}  # type: ignore[typeddict-item]
    )

    assert wire["allowOut"] == ["api.example.com"]
    assert "dnsServers" not in wire


def test_create_leaves_out_an_empty_network_config():
    # Both create paths skip the network field when this is empty.
    assert not build_network_config({})


@pytest.mark.parametrize("dns_servers", [[], ["1.1.1.1"]])
def test_update_sends_dns_servers(dns_servers):
    network: SandboxNetworkUpdate = {
        "allow_out": ["api.example.com"],
        "dns_servers": dns_servers,
    }

    assert build_network_update_body(network).to_dict() == {
        "allowOut": ["api.example.com"],
        "dnsServers": dns_servers,
    }


def test_update_omits_dns_servers_when_not_provided():
    assert build_network_update_body({"allow_out": ["api.example.com"]}).to_dict() == {
        "allowOut": ["api.example.com"],
    }


def test_update_treats_none_as_not_set():
    network = {"allow_out": ["api.example.com"], "dns_servers": None}

    assert build_network_update_body(network).to_dict() == {  # type: ignore[arg-type]
        "allowOut": ["api.example.com"],
    }


@pytest.mark.parametrize("dns_servers", [[], ["1.1.1.1"]])
def test_get_info_reports_dns_servers(dns_servers):
    info = from_client_network_config(
        SandboxNetworkConfig.from_dict(
            {"allowOut": ["api.example.com"], "dnsServers": dns_servers}
        )
    )

    assert info is not None
    assert info["dns_servers"] == dns_servers


def test_get_info_leaves_dns_servers_unset_when_the_api_omits_it():
    info = from_client_network_config(
        SandboxNetworkConfig.from_dict({"allowOut": ["api.example.com"]})
    )

    assert info is not None
    assert "dns_servers" not in info
