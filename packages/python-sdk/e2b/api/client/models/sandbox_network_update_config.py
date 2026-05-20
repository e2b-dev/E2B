from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
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
            allow_internet_access (Union[Unset, bool]): Allow sandbox to access the internet. When set to false, it behaves
                the same as specifying denyOut to 0.0.0.0/0 in the network config.
            deny_out (Union[Unset, list[str]]): List of denied CIDR blocks or IP addresses for egress traffic. Domain names
                are not supported for deny rules.
            rules (Union[Unset, SandboxNetworkUpdateConfigRules]): Per-domain transform rules. Replaces all existing rules
                when provided.
    """

    allow_out: Union[Unset, list[str]] = UNSET
    allow_internet_access: Union[Unset, bool] = UNSET
    deny_out: Union[Unset, list[str]] = UNSET
    rules: Union[Unset, "SandboxNetworkUpdateConfigRules"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        allow_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.allow_out, Unset):
            allow_out = self.allow_out

        allow_internet_access = self.allow_internet_access

        deny_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.deny_out, Unset):
            deny_out = self.deny_out

        rules: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.rules, Unset):
            rules = self.rules.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if allow_out is not UNSET:
            field_dict["allowOut"] = allow_out
        if allow_internet_access is not UNSET:
            field_dict["allow_internet_access"] = allow_internet_access
        if deny_out is not UNSET:
            field_dict["denyOut"] = deny_out
        if rules is not UNSET:
            field_dict["rules"] = rules

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_network_update_config_rules import (
            SandboxNetworkUpdateConfigRules,
        )

        d = dict(src_dict)
        allow_out = cast(list[str], d.pop("allowOut", UNSET))

        allow_internet_access = d.pop("allow_internet_access", UNSET)

        deny_out = cast(list[str], d.pop("denyOut", UNSET))

        _rules = d.pop("rules", UNSET)
        rules: Union[Unset, SandboxNetworkUpdateConfigRules]
        if isinstance(_rules, Unset):
            rules = UNSET
        else:
            rules = SandboxNetworkUpdateConfigRules.from_dict(_rules)

        sandbox_network_update_config = cls(
            allow_out=allow_out,
            allow_internet_access=allow_internet_access,
            deny_out=deny_out,
            rules=rules,
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
