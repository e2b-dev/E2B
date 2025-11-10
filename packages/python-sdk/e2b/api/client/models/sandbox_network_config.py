from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxNetworkConfig")


@_attrs_define
class SandboxNetworkConfig:
    """
    Attributes:
        allow_out (Union[Unset, list[str]]): List of allowed CIDR blocks or IP addresses for egress traffic
        block_out (Union[Unset, list[str]]): List of blocked CIDR blocks or IP addresses for egress traffic
    """

    allow_out: Union[Unset, list[str]] = UNSET
    block_out: Union[Unset, list[str]] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        allow_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.allow_out, Unset):
            allow_out = self.allow_out

        block_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.block_out, Unset):
            block_out = self.block_out

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if allow_out is not UNSET:
            field_dict["allowOut"] = allow_out
        if block_out is not UNSET:
            field_dict["blockOut"] = block_out

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        allow_out = cast(list[str], d.pop("allowOut", UNSET))

        block_out = cast(list[str], d.pop("blockOut", UNSET))

        sandbox_network_config = cls(
            allow_out=allow_out,
            block_out=block_out,
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
