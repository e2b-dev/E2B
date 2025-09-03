from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.general_registry_type import GeneralRegistryType

T = TypeVar("T", bound="GeneralRegistry")


@_attrs_define
class GeneralRegistry:
    """
    Attributes:
        password (str): Password to use for the registry
        type_ (GeneralRegistryType): Type of registry authentication
        username (str): Username to use for the registry
    """

    password: str
    type_: GeneralRegistryType
    username: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        password = self.password

        type_ = self.type_.value

        username = self.username

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "password": password,
                "type": type_,
                "username": username,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        password = d.pop("password")

        type_ = GeneralRegistryType(d.pop("type"))

        username = d.pop("username")

        general_registry = cls(
            password=password,
            type_=type_,
            username=username,
        )

        general_registry.additional_properties = d
        return general_registry

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
