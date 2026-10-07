from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxEgressProxyTLSConfigType0")


@_attrs_define
class SandboxEgressProxyTLSConfigType0:
    """TLS for the connection to the SOCKS5 proxy. The SOCKS5 negotiation and the tunneled traffic both run inside the TLS
    session, so the proxy credentials are not sent in the clear. This secures only the hop to the proxy; what the proxy
    does onward is its own concern. A half-close from the sandbox reaches the proxy as a TLS close_notify, not a TCP
    FIN, and a proxy that treats close_notify as a full close cuts the reply short.

        Attributes:
            enabled (bool): Connect to the proxy over TLS. When false, no other field in this object may be set.
            server_name (Union[Unset, str]): Name to verify the proxy certificate against, and to send as SNI. Defaults to
                the host part of address. Set this only when the certificate does not match the address the proxy is reached at.
            ca_cert (Union[Unset, str]): One or more PEM-encoded certificates to verify the proxy against, for a proxy
                fronted by a private CA. These replace the system trust store, which is what is used when this is omitted. The
                system trust store depends on the host the orchestrator runs on, so set this to get the same verification
                everywhere.
    """

    enabled: bool
    server_name: Union[Unset, str] = UNSET
    ca_cert: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        enabled = self.enabled

        server_name = self.server_name

        ca_cert = self.ca_cert

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "enabled": enabled,
            }
        )
        if server_name is not UNSET:
            field_dict["serverName"] = server_name
        if ca_cert is not UNSET:
            field_dict["caCert"] = ca_cert

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        enabled = d.pop("enabled")

        server_name = d.pop("serverName", UNSET)

        ca_cert = d.pop("caCert", UNSET)

        sandbox_egress_proxy_tls_config_type_0 = cls(
            enabled=enabled,
            server_name=server_name,
            ca_cert=ca_cert,
        )

        sandbox_egress_proxy_tls_config_type_0.additional_properties = d
        return sandbox_egress_proxy_tls_config_type_0

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
