from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.gcp_registry_type import GCPRegistryType

T = TypeVar("T", bound="GCPRegistry")


@_attrs_define
class GCPRegistry:
    """
    Attributes:
        service_account_json (str): Service Account JSON for GCP authentication
        type_ (GCPRegistryType): Type of registry authentication
    """

    service_account_json: str
    type_: GCPRegistryType
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        service_account_json = self.service_account_json

        type_ = self.type_.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "serviceAccountJson": service_account_json,
                "type": type_,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        service_account_json = d.pop("serviceAccountJson")

        type_ = GCPRegistryType(d.pop("type"))

        gcp_registry = cls(
            service_account_json=service_account_json,
            type_=type_,
        )

        gcp_registry.additional_properties = d
        return gcp_registry

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
