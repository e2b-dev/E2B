from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_firewall_rule_transform import SandboxFirewallRuleTransform


T = TypeVar("T", bound="SandboxFirewallRule")


@_attrs_define
class SandboxFirewallRule:
    """Firewall rule applied to outbound requests matching the host it is registered under.

    Attributes:
        transform (Union[Unset, SandboxFirewallRuleTransform]): Transform applied to egress requests matching a firewall
            rule.
    """

    transform: Union[Unset, "SandboxFirewallRuleTransform"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        transform: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.transform, Unset):
            transform = self.transform.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if transform is not UNSET:
            field_dict["transform"] = transform

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_firewall_rule_transform import (
            SandboxFirewallRuleTransform,
        )

        d = dict(src_dict)
        _transform = d.pop("transform", UNSET)
        transform: Union[Unset, SandboxFirewallRuleTransform]
        if isinstance(_transform, Unset):
            transform = UNSET
        else:
            transform = SandboxFirewallRuleTransform.from_dict(_transform)

        sandbox_firewall_rule = cls(
            transform=transform,
        )

        sandbox_firewall_rule.additional_properties = d
        return sandbox_firewall_rule

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
