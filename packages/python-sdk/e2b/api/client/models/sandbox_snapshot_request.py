from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxSnapshotRequest")


@_attrs_define
class SandboxSnapshotRequest:
    """
    Attributes:
        name (Union[Unset, str]): Optional name for the snapshot template. If a snapshot template with this name already
            exists, a new build will be assigned to the existing template instead of creating a new one.
        memory (Union[Unset, bool]): Whether to capture a full memory snapshot. When false, only the filesystem is
            persisted: the snapshot is smaller and faster to take, and sandboxes created from it cold-boot (start fresh from
            disk) instead of restoring memory, so they begin without the source sandbox's running processes, in-memory
            state, and open connections. The source sandbox keeps running in both cases. Defaults to true.
    """

    name: Union[Unset, str] = UNSET
    memory: Union[Unset, bool] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        memory = self.memory

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if memory is not UNSET:
            field_dict["memory"] = memory

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        memory = d.pop("memory", UNSET)

        sandbox_snapshot_request = cls(
            name=name,
            memory=memory,
        )

        sandbox_snapshot_request.additional_properties = d
        return sandbox_snapshot_request

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
