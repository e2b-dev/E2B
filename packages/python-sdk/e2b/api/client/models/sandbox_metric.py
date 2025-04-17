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
        mem_total_mi_b (int): Total memory in MiB
        mem_used_mi_b (int): Memory used in MiB
        timestamp (datetime.datetime): Timestamp of the metric entry
    """

    cpu_count: int
    cpu_used_pct: float
    mem_total_mi_b: int
    mem_used_mi_b: int
    timestamp: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cpu_count = self.cpu_count

        cpu_used_pct = self.cpu_used_pct

        mem_total_mi_b = self.mem_total_mi_b

        mem_used_mi_b = self.mem_used_mi_b

        timestamp = self.timestamp.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cpuCount": cpu_count,
                "cpuUsedPct": cpu_used_pct,
                "memTotalMiB": mem_total_mi_b,
                "memUsedMiB": mem_used_mi_b,
                "timestamp": timestamp,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        cpu_count = d.pop("cpuCount")

        cpu_used_pct = d.pop("cpuUsedPct")

        mem_total_mi_b = d.pop("memTotalMiB")

        mem_used_mi_b = d.pop("memUsedMiB")

        timestamp = isoparse(d.pop("timestamp"))

        sandbox_metric = cls(
            cpu_count=cpu_count,
            cpu_used_pct=cpu_used_pct,
            mem_total_mi_b=mem_total_mi_b,
            mem_used_mi_b=mem_used_mi_b,
            timestamp=timestamp,
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
