from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.disk_metrics import DiskMetrics


T = TypeVar("T", bound="NodeMetrics")


@_attrs_define
class NodeMetrics:
    """Node metrics

    Attributes:
        allocated_cpu (int): Number of allocated CPU cores
        allocated_memory_bytes (int): Amount of allocated memory in bytes
        cpu_count (int): Total number of CPU cores on the node
        cpu_percent (int): Node CPU usage percentage
        disks (list['DiskMetrics']): Detailed metrics for each disk/mount point
        memory_total_bytes (int): Total node memory in bytes
        memory_used_bytes (int): Node memory used in bytes
    """

    allocated_cpu: int
    allocated_memory_bytes: int
    cpu_count: int
    cpu_percent: int
    disks: list["DiskMetrics"]
    memory_total_bytes: int
    memory_used_bytes: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        allocated_cpu = self.allocated_cpu

        allocated_memory_bytes = self.allocated_memory_bytes

        cpu_count = self.cpu_count

        cpu_percent = self.cpu_percent

        disks = []
        for disks_item_data in self.disks:
            disks_item = disks_item_data.to_dict()
            disks.append(disks_item)

        memory_total_bytes = self.memory_total_bytes

        memory_used_bytes = self.memory_used_bytes

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "allocatedCPU": allocated_cpu,
                "allocatedMemoryBytes": allocated_memory_bytes,
                "cpuCount": cpu_count,
                "cpuPercent": cpu_percent,
                "disks": disks,
                "memoryTotalBytes": memory_total_bytes,
                "memoryUsedBytes": memory_used_bytes,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.disk_metrics import DiskMetrics

        d = dict(src_dict)
        allocated_cpu = d.pop("allocatedCPU")

        allocated_memory_bytes = d.pop("allocatedMemoryBytes")

        cpu_count = d.pop("cpuCount")

        cpu_percent = d.pop("cpuPercent")

        disks = []
        _disks = d.pop("disks")
        for disks_item_data in _disks:
            disks_item = DiskMetrics.from_dict(disks_item_data)

            disks.append(disks_item)

        memory_total_bytes = d.pop("memoryTotalBytes")

        memory_used_bytes = d.pop("memoryUsedBytes")

        node_metrics = cls(
            allocated_cpu=allocated_cpu,
            allocated_memory_bytes=allocated_memory_bytes,
            cpu_count=cpu_count,
            cpu_percent=cpu_percent,
            disks=disks,
            memory_total_bytes=memory_total_bytes,
            memory_used_bytes=memory_used_bytes,
        )

        node_metrics.additional_properties = d
        return node_metrics

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
