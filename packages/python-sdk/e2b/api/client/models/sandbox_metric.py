import datetime
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="SandboxMetric")


@_attrs_define
class SandboxMetric:
    """Metric entry with timestamp and line

    Attributes:
        timestamp (datetime.datetime): Timestamp of the metric entry
        cpu_count (int): Number of CPU cores
        cpu_used_pct (float): CPU usage percentage
        mem_used_mi_b (int): Memory used in MiB
        mem_total_mi_b (int): Total memory in MiB
    """

    timestamp: datetime.datetime
    cpu_count: int
    cpu_used_pct: float
    mem_used_mi_b: int
    mem_total_mi_b: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timestamp = self.timestamp.isoformat()

        cpu_count = self.cpu_count

        cpu_used_pct = self.cpu_used_pct

        mem_used_mi_b = self.mem_used_mi_b

        mem_total_mi_b = self.mem_total_mi_b

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timestamp": timestamp,
                "cpuCount": cpu_count,
                "cpuUsedPct": cpu_used_pct,
                "memUsedMiB": mem_used_mi_b,
                "memTotalMiB": mem_total_mi_b,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        timestamp = isoparse(d.pop("timestamp"))

        cpu_count = d.pop("cpuCount")

        cpu_used_pct = d.pop("cpuUsedPct")

        mem_used_mi_b = d.pop("memUsedMiB")

        mem_total_mi_b = d.pop("memTotalMiB")

        sandbox_metric = cls(
            timestamp=timestamp,
            cpu_count=cpu_count,
            cpu_used_pct=cpu_used_pct,
            mem_used_mi_b=mem_used_mi_b,
            mem_total_mi_b=mem_total_mi_b,
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
