from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="DiskMetrics")


@_attrs_define
class DiskMetrics:
    """
    Attributes:
        mount_point (str): Mount point of the disk
        device (str): Device name
        filesystem_type (str): Filesystem type (e.g., ext4, xfs)
        used_bytes (int): Used space in bytes
        total_bytes (int): Total space in bytes
    """

    mount_point: str
    device: str
    filesystem_type: str
    used_bytes: int
    total_bytes: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        mount_point = self.mount_point

        device = self.device

        filesystem_type = self.filesystem_type

        used_bytes = self.used_bytes

        total_bytes = self.total_bytes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "mountPoint": mount_point,
                "device": device,
                "filesystemType": filesystem_type,
                "usedBytes": used_bytes,
                "totalBytes": total_bytes,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mount_point = d.pop("mountPoint")

        device = d.pop("device")

        filesystem_type = d.pop("filesystemType")

        used_bytes = d.pop("usedBytes")

        total_bytes = d.pop("totalBytes")

        disk_metrics = cls(
            mount_point=mount_point,
            device=device,
            filesystem_type=filesystem_type,
            used_bytes=used_bytes,
            total_bytes=total_bytes,
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
