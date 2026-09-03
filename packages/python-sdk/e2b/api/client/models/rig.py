from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Rig")


@_attrs_define
class Rig:
    """An orchestrator node pool backed by one cloud scaling group

    Attributes:
        id (str): Rig identifier (e.g. "default")
        provider (str): Cloud provider backing the rig ("aws" or "gcp")
        resource_id (str): Canonical cloud resource ID of the scaling group backing the rig (ARN on AWS, self-link on
            GCP)
        capacity_desired (int): Desired number of instances in the rig
        capacity_current (int): Number of instances currently attached to the rig
        capacity_min (Union[Unset, int]): Minimum capacity enforced on the rig's scaling group. Omitted when nothing
            enforces bounds (GCP MIG without an active autoscaler).
        capacity_max (Union[Unset, int]): Maximum capacity enforced on the rig's scaling group. Omitted when nothing
            enforces bounds (GCP MIG without an active autoscaler).
    """

    id: str
    provider: str
    resource_id: str
    capacity_desired: int
    capacity_current: int
    capacity_min: Union[Unset, int] = UNSET
    capacity_max: Union[Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        provider = self.provider

        resource_id = self.resource_id

        capacity_desired = self.capacity_desired

        capacity_current = self.capacity_current

        capacity_min = self.capacity_min

        capacity_max = self.capacity_max

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "provider": provider,
                "resourceID": resource_id,
                "capacityDesired": capacity_desired,
                "capacityCurrent": capacity_current,
            }
        )
        if capacity_min is not UNSET:
            field_dict["capacityMin"] = capacity_min
        if capacity_max is not UNSET:
            field_dict["capacityMax"] = capacity_max

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        provider = d.pop("provider")

        resource_id = d.pop("resourceID")

        capacity_desired = d.pop("capacityDesired")

        capacity_current = d.pop("capacityCurrent")

        capacity_min = d.pop("capacityMin", UNSET)

        capacity_max = d.pop("capacityMax", UNSET)

        rig = cls(
            id=id,
            provider=provider,
            resource_id=resource_id,
            capacity_desired=capacity_desired,
            capacity_current=capacity_current,
            capacity_min=capacity_min,
            capacity_max=capacity_max,
        )

        rig.additional_properties = d
        return rig

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
