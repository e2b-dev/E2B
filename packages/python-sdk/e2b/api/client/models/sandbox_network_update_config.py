from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_egress_proxy_config_type_0 import (
        SandboxEgressProxyConfigType0,
    )
    from ..models.sandbox_network_update_config_rules import (
        SandboxNetworkUpdateConfigRules,
    )


T = TypeVar("T", bound="SandboxNetworkUpdateConfig")


@_attrs_define
class SandboxNetworkUpdateConfig:
    """Network configuration update for a running sandbox. Replaces the current egress rules with the provided
    configuration. Omitting a field clears it.

        Attributes:
            allow_out (Union[Unset, list[str]]): List of allowed destinations for egress traffic. Each entry can be a CIDR
                block (e.g. "8.8.8.8/32"), a bare IP address (e.g. "8.8.8.8"), or a domain name (e.g. "example.com",
                "*.example.com"). Allowed entries always take precedence over denied entries.
            deny_out (Union[Unset, list[str]]): List of denied CIDR blocks or IP addresses for egress traffic. Domain names
                are not supported for deny rules.
            egress_proxy (Union['SandboxEgressProxyConfigType0', None, Unset]): SOCKS5 proxy for sandbox egress. Outbound
                TCP is tunneled through the proxy after allow/deny filtering; the sandbox is unaware. Domain-matched flows use
                remote DNS (ATYP=domain).
            rules (Union[Unset, SandboxNetworkUpdateConfigRules]): Per-domain transform rules. Replaces all existing rules
                when provided.
            allow_internet_access (Union[Unset, bool]): Allow sandbox to access the internet. When set to false, it behaves
                the same as specifying denyOut to 0.0.0.0/0 in the network config.
    """

    allow_out: Union[Unset, list[str]] = UNSET
    deny_out: Union[Unset, list[str]] = UNSET
    egress_proxy: Union["SandboxEgressProxyConfigType0", None, Unset] = UNSET
    rules: Union[Unset, "SandboxNetworkUpdateConfigRules"] = UNSET
    allow_internet_access: Union[Unset, bool] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.sandbox_egress_proxy_config_type_0 import (
            SandboxEgressProxyConfigType0,
        )

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

        rules: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.rules, Unset):
            rules = self.rules.to_dict()

        allow_internet_access = self.allow_internet_access

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if allow_out is not UNSET:
            field_dict["allowOut"] = allow_out
        if deny_out is not UNSET:
            field_dict["denyOut"] = deny_out
        if egress_proxy is not UNSET:
            field_dict["egressProxy"] = egress_proxy
        if rules is not UNSET:
            field_dict["rules"] = rules
        if allow_internet_access is not UNSET:
            field_dict["allow_internet_access"] = allow_internet_access

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_egress_proxy_config_type_0 import (
            SandboxEgressProxyConfigType0,
        )
        from ..models.sandbox_network_update_config_rules import (
            SandboxNetworkUpdateConfigRules,
        )

        d = dict(src_dict)
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

        _rules = d.pop("rules", UNSET)
        rules: Union[Unset, SandboxNetworkUpdateConfigRules]
        if isinstance(_rules, Unset):
            rules = UNSET
        else:
            rules = SandboxNetworkUpdateConfigRules.from_dict(_rules)

        allow_internet_access = d.pop("allow_internet_access", UNSET)

        sandbox_network_update_config = cls(
            allow_out=allow_out,
            deny_out=deny_out,
            egress_proxy=egress_proxy,
            rules=rules,
            allow_internet_access=allow_internet_access,
        )

        sandbox_network_update_config.additional_properties = d
        return sandbox_network_update_config

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
