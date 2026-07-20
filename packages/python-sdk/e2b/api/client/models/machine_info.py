from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="MachineInfo")


@_attrs_define
class MachineInfo:
    """
    Attributes:
        cpu_family (str): CPU family of the node
        cpu_model (str): CPU model of the node
        cpu_model_name (str): CPU model name of the node
        cpu_architecture (str): CPU architecture of the node
    """

    cpu_family: str
    cpu_model: str
    cpu_model_name: str
    cpu_architecture: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cpu_family = self.cpu_family

        cpu_model = self.cpu_model

        cpu_model_name = self.cpu_model_name

        cpu_architecture = self.cpu_architecture

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cpuFamily": cpu_family,
                "cpuModel": cpu_model,
                "cpuModelName": cpu_model_name,
                "cpuArchitecture": cpu_architecture,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        cpu_family = d.pop("cpuFamily")

        cpu_model = d.pop("cpuModel")

        cpu_model_name = d.pop("cpuModelName")

        cpu_architecture = d.pop("cpuArchitecture")

        machine_info = cls(
            cpu_family=cpu_family,
            cpu_model=cpu_model,
            cpu_model_name=cpu_model_name,
            cpu_architecture=cpu_architecture,
        )

        machine_info.additional_properties = d
        return machine_info

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
