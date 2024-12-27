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
        timestamp (datetime.datetime): Timestamp of the log entry
        cpu_pct (float): CPU usage percentage
        cpu_count (int): Number of CPU cores
        mem_mi_b_used (int): Memory used in MiB
        mem_mi_b_total (int): Total memory in MiB
    """

    timestamp: datetime.datetime
    cpu_pct: float
    cpu_count: int
    mem_mi_b_used: int
    mem_mi_b_total: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timestamp = self.timestamp.isoformat()

        cpu_pct = self.cpu_pct

        cpu_count = self.cpu_count

        mem_mi_b_used = self.mem_mi_b_used

        mem_mi_b_total = self.mem_mi_b_total

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timestamp": timestamp,
                "cpuPct": cpu_pct,
                "cpuCount": cpu_count,
                "memMiBUsed": mem_mi_b_used,
                "memMiBTotal": mem_mi_b_total,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        timestamp = isoparse(d.pop("timestamp"))

        cpu_pct = d.pop("cpuPct")

        cpu_count = d.pop("cpuCount")

        mem_mi_b_used = d.pop("memMiBUsed")

        mem_mi_b_total = d.pop("memMiBTotal")

        sandbox_metric = cls(
            timestamp=timestamp,
            cpu_pct=cpu_pct,
            cpu_count=cpu_count,
            mem_mi_b_used=mem_mi_b_used,
            mem_mi_b_total=mem_mi_b_total,
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
