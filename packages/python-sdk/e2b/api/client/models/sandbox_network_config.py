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
        allow_out (Union[Unset, list[str]]): List of allowed CIDR blocks or IP addresses for egress traffic. Allowed
            addresses always take precedence over blocked addresses.
        allow_public_traffic (Union[Unset, bool]): Specify if the sandbox URLs should be accessible only with
            authentication. Default: True.
        deny_out (Union[Unset, list[str]]): List of denied CIDR blocks or IP addresses for egress traffic
        mask_request_host (Union[Unset, str]): Specify host mask which will be used for all sandbox requests
    """

    allow_out: Union[Unset, list[str]] = UNSET
    allow_public_traffic: Union[Unset, bool] = True
    deny_out: Union[Unset, list[str]] = UNSET
    mask_request_host: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        allow_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.allow_out, Unset):
            allow_out = self.allow_out

        allow_public_traffic = self.allow_public_traffic

        deny_out: Union[Unset, list[str]] = UNSET
        if not isinstance(self.deny_out, Unset):
            deny_out = self.deny_out

        mask_request_host = self.mask_request_host

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if allow_out is not UNSET:
            field_dict["allowOut"] = allow_out
        if allow_public_traffic is not UNSET:
            field_dict["allowPublicTraffic"] = allow_public_traffic
        if deny_out is not UNSET:
            field_dict["denyOut"] = deny_out
        if mask_request_host is not UNSET:
            field_dict["maskRequestHost"] = mask_request_host

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        allow_out = cast(list[str], d.pop("allowOut", UNSET))

        allow_public_traffic = d.pop("allowPublicTraffic", UNSET)

        deny_out = cast(list[str], d.pop("denyOut", UNSET))

        mask_request_host = d.pop("maskRequestHost", UNSET)

        sandbox_network_config = cls(
            allow_out=allow_out,
            allow_public_traffic=allow_public_traffic,
            deny_out=deny_out,
            mask_request_host=mask_request_host,
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
