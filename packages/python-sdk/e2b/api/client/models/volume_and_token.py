from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="VolumeAndToken")


@_attrs_define
class VolumeAndToken:
    """
    Attributes:
        name (str): Name of the volume
        token (str): Auth token to use for interacting with volume content
        volume_id (str): ID of the volume
    """

    name: str
    token: str
    volume_id: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        token = self.token

        volume_id = self.volume_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "token": token,
                "volumeID": volume_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        token = d.pop("token")

        volume_id = d.pop("volumeID")

        volume_and_token = cls(
            name=name,
            token=token,
            volume_id=volume_id,
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
