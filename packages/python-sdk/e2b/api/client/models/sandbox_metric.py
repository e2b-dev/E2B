import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="SandboxMetric")


@_attrs_define
class SandboxMetric:
    """Metric entry with timestamp and line

    Attributes:
        cpu_count (int): Number of CPU cores
        cpu_used_pct (float): CPU usage percentage
        disk_total (int): Total disk space in bytes
        disk_used (int): Disk used in bytes
        mem_total (int): Total memory in bytes
        mem_used (int): Memory used in bytes
        timestamp (datetime.datetime): Timestamp of the metric entry
        timestamp_unix (int): Timestamp of the metric entry in Unix time (seconds since epoch)
    """

    cpu_count: int
    cpu_used_pct: float
    disk_total: int
    disk_used: int
    mem_total: int
    mem_used: int
    timestamp: datetime.datetime
    timestamp_unix: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cpu_count = self.cpu_count

        cpu_used_pct = self.cpu_used_pct

        disk_total = self.disk_total

        disk_used = self.disk_used

        mem_total = self.mem_total

        mem_used = self.mem_used

        timestamp = self.timestamp.isoformat()

        timestamp_unix = self.timestamp_unix

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cpuCount": cpu_count,
                "cpuUsedPct": cpu_used_pct,
                "diskTotal": disk_total,
                "diskUsed": disk_used,
                "memTotal": mem_total,
                "memUsed": mem_used,
                "timestamp": timestamp,
                "timestampUnix": timestamp_unix,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        cpu_count = d.pop("cpuCount")

        cpu_used_pct = d.pop("cpuUsedPct")

        disk_total = d.pop("diskTotal")

        disk_used = d.pop("diskUsed")

        mem_total = d.pop("memTotal")

        mem_used = d.pop("memUsed")

        timestamp = isoparse(d.pop("timestamp"))

        timestamp_unix = d.pop("timestampUnix")

        sandbox_metric = cls(
            cpu_count=cpu_count,
            cpu_used_pct=cpu_used_pct,
            disk_total=disk_total,
            disk_used=disk_used,
            mem_total=mem_total,
            mem_used=mem_used,
            timestamp=timestamp,
            timestamp_unix=timestamp_unix,
        )

        sandbox_metric.additional_properties = d
        return sandbox_metric

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
