import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="SidecarStateVersion")


@_attrs_define
class SidecarStateVersion:
    """One immutable version of a saved sidecar state.

    Attributes:
        name (str): Name of a saved sidecar state, unique within the team
        entry (str): Catalog entry the state was saved from
        version (int): Version number, counted from one under the name
        entry_version (str): Catalog entry version the state was saved from
        size_bytes (int): Size of the version's data layer in bytes
        source_sandbox_id (str): Sandbox the version was saved from
        created_at (datetime.datetime): When the version was saved
    """

    name: str
    entry: str
    version: int
    entry_version: str
    size_bytes: int
    source_sandbox_id: str
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        entry = self.entry

        version = self.version

        entry_version = self.entry_version

        size_bytes = self.size_bytes

        source_sandbox_id = self.source_sandbox_id

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "entry": entry,
                "version": version,
                "entryVersion": entry_version,
                "sizeBytes": size_bytes,
                "sourceSandboxID": source_sandbox_id,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        entry = d.pop("entry")

        version = d.pop("version")

        entry_version = d.pop("entryVersion")

        size_bytes = d.pop("sizeBytes")

        source_sandbox_id = d.pop("sourceSandboxID")

        created_at = isoparse(d.pop("createdAt"))

        sidecar_state_version = cls(
            name=name,
            entry=entry,
            version=version,
            entry_version=entry_version,
            size_bytes=size_bytes,
            source_sandbox_id=source_sandbox_id,
            created_at=created_at,
        )

        sidecar_state_version.additional_properties = d
        return sidecar_state_version

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
