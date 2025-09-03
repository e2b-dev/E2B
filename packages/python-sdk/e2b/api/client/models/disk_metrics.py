from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="DiskMetrics")


@_attrs_define
class DiskMetrics:
    """
    Attributes:
        device (str): Device name
        filesystem_type (str): Filesystem type (e.g., ext4, xfs)
        mount_point (str): Mount point of the disk
        total_bytes (int): Total space in bytes
        used_bytes (int): Used space in bytes
    """

    device: str
    filesystem_type: str
    mount_point: str
    total_bytes: int
    used_bytes: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        device = self.device

        filesystem_type = self.filesystem_type

        mount_point = self.mount_point

        total_bytes = self.total_bytes

        used_bytes = self.used_bytes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "device": device,
                "filesystemType": filesystem_type,
                "mountPoint": mount_point,
                "totalBytes": total_bytes,
                "usedBytes": used_bytes,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        device = d.pop("device")

        filesystem_type = d.pop("filesystemType")

        mount_point = d.pop("mountPoint")

        total_bytes = d.pop("totalBytes")

        used_bytes = d.pop("usedBytes")

        disk_metrics = cls(
            device=device,
            filesystem_type=filesystem_type,
            mount_point=mount_point,
            total_bytes=total_bytes,
            used_bytes=used_bytes,
        )

        disk_metrics.additional_properties = d
        return disk_metrics

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
