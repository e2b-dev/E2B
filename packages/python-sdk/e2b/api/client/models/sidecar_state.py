import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="SidecarState")


@_attrs_define
class SidecarState:
    """A team's saved sidecar state, named and versioned.

    Attributes:
        name (str): Name of a saved sidecar state, unique within the team.
        entry (str): Name of the catalog entry this state belongs to.
        size_mi_b (int): Size of the entry's data disk when the name was created. A state only attaches to an entry of
            the same size.
        latest_version (int): Highest version under the name, which an attach without a pin resolves to.
        version_count (int):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    name: str
    entry: str
    size_mi_b: int
    latest_version: int
    version_count: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        entry = self.entry

        size_mi_b = self.size_mi_b

        latest_version = self.latest_version

        version_count = self.version_count

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "entry": entry,
                "sizeMiB": size_mi_b,
                "latestVersion": latest_version,
                "versionCount": version_count,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        entry = d.pop("entry")

        size_mi_b = d.pop("sizeMiB")

        latest_version = d.pop("latestVersion")

        version_count = d.pop("versionCount")

        created_at = isoparse(d.pop("createdAt"))

        updated_at = isoparse(d.pop("updatedAt"))

        sidecar_state = cls(
            name=name,
            entry=entry,
            size_mi_b=size_mi_b,
            latest_version=latest_version,
            version_count=version_count,
            created_at=created_at,
            updated_at=updated_at,
        )

        sidecar_state.additional_properties = d
        return sidecar_state

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
