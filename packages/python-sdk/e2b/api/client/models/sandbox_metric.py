import datetime
from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="SandboxMetric")


@_attrs_define
class SandboxMetric:
    """Metric entry with timestamp and line

    Attributes:
        cpu_count (int): Number of CPU cores
        cpu_pct (float): CPU usage percentage
        mem_total_mi_b (int): Total memory in MiB
        mem_used_mi_b (int): Memory used in MiB
        timestamp (datetime.datetime): Timestamp of the metric entry
    """

    cpu_count: int
    cpu_pct: float
    mem_total_mi_b: int
    mem_used_mi_b: int
    timestamp: datetime.datetime
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        cpu_count = self.cpu_count

        cpu_pct = self.cpu_pct

        mem_total_mi_b = self.mem_total_mi_b

        mem_used_mi_b = self.mem_used_mi_b

        timestamp = self.timestamp.isoformat()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cpuCount": cpu_count,
                "cpuPct": cpu_pct,
                "memTotalMiB": mem_total_mi_b,
                "memUsedMiB": mem_used_mi_b,
                "timestamp": timestamp,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        cpu_count = d.pop("cpuCount")

        cpu_pct = d.pop("cpuPct")

        mem_total_mi_b = d.pop("memTotalMiB")

        mem_used_mi_b = d.pop("memUsedMiB")

        timestamp = isoparse(d.pop("timestamp"))

        sandbox_metric = cls(
            cpu_count=cpu_count,
            cpu_pct=cpu_pct,
            mem_total_mi_b=mem_total_mi_b,
            mem_used_mi_b=mem_used_mi_b,
            timestamp=timestamp,
        )

        sandbox_metric.additional_properties = d
        return sandbox_metric

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
