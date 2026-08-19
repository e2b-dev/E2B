from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_egress_proxy_config_type_0 import (
        SandboxEgressProxyConfigType0,
    )
    from ..models.sandbox_network_config_rules import SandboxNetworkConfigRules


T = TypeVar("T", bound="SandboxNetworkConfig")


@_attrs_define
class SandboxNetworkConfig:
    """
    Attributes:
        allow_public_traffic (Union[Unset, bool]): Specify if the sandbox URLs should be accessible only with
            authentication. Default: True.
        allow_out (Union[Unset, list[str]]): List of allowed destinations for egress traffic. Each entry can be a CIDR
            block (e.g. "8.8.8.8/32"), a bare IP address (e.g. "8.8.8.8"), or a domain name (e.g. "example.com",
            "*.example.com"). Allowed entries always take precedence over denied entries.
        deny_out (Union[Unset, list[str]]): List of denied CIDR blocks or IP addresses for egress traffic. Domain names
            are not supported for deny rules.
        egress_proxy (Union['SandboxEgressProxyConfigType0', None, Unset]): SOCKS5 proxy for sandbox egress. Outbound
            TCP is tunneled through the proxy after allow/deny filtering; the sandbox is unaware. Domain-matched flows use
            remote DNS (ATYP=domain).
        mask_request_host (Union[Unset, str]): Specify host mask which will be used for all sandbox requests
        rules (Union[Unset, SandboxNetworkConfigRules]): Per-domain transform rules applied to matching egress
            HTTP/HTTPS requests. Keys are domains (e.g. "api.example.com", "example.com"). A domain listed here is not
            automatically allowed - use allowOut to permit the traffic.
    """

    allow_public_traffic: Union[Unset, bool] = True
    allow_out: Union[Unset, list[str]] = UNSET
    deny_out: Union[Unset, list[str]] = UNSET
    egress_proxy: Union["SandboxEgressProxyConfigType0", None, Unset] = UNSET
    mask_request_host: Union[Unset, str] = UNSET
    rules: Union[Unset, "SandboxNetworkConfigRules"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.sandbox_egress_proxy_config_type_0 import (
            SandboxEgressProxyConfigType0,
        )

        allow_public_traffic = self.allow_public_traffic

        allow_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.allow_out, Unset):
            allow_out = self.allow_out

        deny_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.deny_out, Unset):
            deny_out = self.deny_out

        egress_proxy: Union[None, Unset, dict[str, Any]]
        if isinstance(self.egress_proxy, Unset):
            egress_proxy = UNSET
        elif isinstance(self.egress_proxy, SandboxEgressProxyConfigType0):
            egress_proxy = self.egress_proxy.to_dict()
        else:
            egress_proxy = self.egress_proxy

        mask_request_host = self.mask_request_host

        rules: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.rules, Unset):
            rules = self.rules.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if allow_public_traffic is not UNSET:
            field_dict["allowPublicTraffic"] = allow_public_traffic
        if allow_out is not UNSET:
            field_dict["allowOut"] = allow_out
        if deny_out is not UNSET:
            field_dict["denyOut"] = deny_out
        if egress_proxy is not UNSET:
            field_dict["egressProxy"] = egress_proxy
        if mask_request_host is not UNSET:
            field_dict["maskRequestHost"] = mask_request_host
        if rules is not UNSET:
            field_dict["rules"] = rules

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_egress_proxy_config_type_0 import (
            SandboxEgressProxyConfigType0,
        )
        from ..models.sandbox_network_config_rules import SandboxNetworkConfigRules

        d = dict(src_dict)
        allow_public_traffic = d.pop("allowPublicTraffic", UNSET)

        allow_out = cast(list[str], d.pop("allowOut", UNSET))

        deny_out = cast(list[str], d.pop("denyOut", UNSET))

        def _parse_egress_proxy(
            data: object,
        ) -> Union["SandboxEgressProxyConfigType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_sandbox_egress_proxy_config_type_0 = (
                    SandboxEgressProxyConfigType0.from_dict(data)
                )

                return componentsschemas_sandbox_egress_proxy_config_type_0
            except:  # noqa: E722
                pass
            return cast(Union["SandboxEgressProxyConfigType0", None, Unset], data)

        egress_proxy = _parse_egress_proxy(d.pop("egressProxy", UNSET))

        mask_request_host = d.pop("maskRequestHost", UNSET)

        _rules = d.pop("rules", UNSET)
        rules: Union[Unset, SandboxNetworkConfigRules]
        if isinstance(_rules, Unset):
            rules = UNSET
        else:
            rules = SandboxNetworkConfigRules.from_dict(_rules)

        sandbox_network_config = cls(
            allow_public_traffic=allow_public_traffic,
            allow_out=allow_out,
            deny_out=deny_out,
            egress_proxy=egress_proxy,
            mask_request_host=mask_request_host,
            rules=rules,
        )

        sandbox_network_config.additional_properties = d
        return sandbox_network_config

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
