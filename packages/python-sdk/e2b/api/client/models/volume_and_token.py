from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="VolumeAndToken")


@_attrs_define
class VolumeAndToken:
    """
    Attributes:
        volume_id (str): ID of the volume
        name (str): Name of the volume
        token (str): Auth token to use for interacting with volume content
        domain (Union[Unset, str]): Domain to use as the destination for volume content requests,
            replacing the default `api.<E2B_DOMAIN>`. Only returned when the
            team is connected to a custom (BYOC) cluster; absent otherwise, in
            which case the default domain is used.
    """

    volume_id: str
    name: str
    token: str
    domain: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        volume_id = self.volume_id

        name = self.name

        token = self.token

        domain = self.domain

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "volumeID": volume_id,
                "name": name,
                "token": token,
            }
        )
        if domain is not UNSET:
            field_dict["domain"] = domain

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        volume_id = d.pop("volumeID")

        name = d.pop("name")

        token = d.pop("token")

        domain = d.pop("domain", UNSET)

        volume_and_token = cls(
            volume_id=volume_id,
            name=name,
            token=token,
            domain=domain,
        )

        volume_and_token.additional_properties = d
        return volume_and_token

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
