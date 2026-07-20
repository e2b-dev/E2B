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
        cpu_percent (int): Node CPU usage percentage
        cpu_count (int): Total number of CPU cores on the node
        allocated_memory_bytes (int): Amount of allocated memory in bytes
        memory_used_bytes (int): Node memory used in bytes
        memory_total_bytes (int): Total node memory in bytes
        huge_pages_total (int): Total number of preallocated hugepages on the node
        huge_pages_used (int): Number of hugepages in use (total - free)
        huge_pages_reserved (int): Number of reserved hugepages (committed but not yet faulted)
        huge_page_size_bytes (int): Size of a single hugepage in bytes
        disks (list['DiskMetrics']): Detailed metrics for each disk/mount point
    """

    allocated_cpu: int
    cpu_percent: int
    cpu_count: int
    allocated_memory_bytes: int
    memory_used_bytes: int
    memory_total_bytes: int
    huge_pages_total: int
    huge_pages_used: int
    huge_pages_reserved: int
    huge_page_size_bytes: int
    disks: list["DiskMetrics"]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        allocated_cpu = self.allocated_cpu

        cpu_percent = self.cpu_percent

        cpu_count = self.cpu_count

        allocated_memory_bytes = self.allocated_memory_bytes

        memory_used_bytes = self.memory_used_bytes

        memory_total_bytes = self.memory_total_bytes

        huge_pages_total = self.huge_pages_total

        huge_pages_used = self.huge_pages_used

        huge_pages_reserved = self.huge_pages_reserved

        huge_page_size_bytes = self.huge_page_size_bytes

        disks = []
        for disks_item_data in self.disks:
            disks_item = disks_item_data.to_dict()
            disks.append(disks_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "allocatedCPU": allocated_cpu,
                "cpuPercent": cpu_percent,
                "cpuCount": cpu_count,
                "allocatedMemoryBytes": allocated_memory_bytes,
                "memoryUsedBytes": memory_used_bytes,
                "memoryTotalBytes": memory_total_bytes,
                "hugePagesTotal": huge_pages_total,
                "hugePagesUsed": huge_pages_used,
                "hugePagesReserved": huge_pages_reserved,
                "hugePageSizeBytes": huge_page_size_bytes,
                "disks": disks,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.disk_metrics import DiskMetrics

        d = dict(src_dict)
        allocated_cpu = d.pop("allocatedCPU")

        cpu_percent = d.pop("cpuPercent")

        cpu_count = d.pop("cpuCount")

        allocated_memory_bytes = d.pop("allocatedMemoryBytes")

        memory_used_bytes = d.pop("memoryUsedBytes")

        memory_total_bytes = d.pop("memoryTotalBytes")

        huge_pages_total = d.pop("hugePagesTotal")

        huge_pages_used = d.pop("hugePagesUsed")

        huge_pages_reserved = d.pop("hugePagesReserved")

        huge_page_size_bytes = d.pop("hugePageSizeBytes")

        disks = []
        _disks = d.pop("disks")
        for disks_item_data in _disks:
            disks_item = DiskMetrics.from_dict(disks_item_data)

            disks.append(disks_item)

        node_metrics = cls(
            allocated_cpu=allocated_cpu,
            cpu_percent=cpu_percent,
            cpu_count=cpu_count,
            allocated_memory_bytes=allocated_memory_bytes,
            memory_used_bytes=memory_used_bytes,
            memory_total_bytes=memory_total_bytes,
            huge_pages_total=huge_pages_total,
            huge_pages_used=huge_pages_used,
            huge_pages_reserved=huge_pages_reserved,
            huge_page_size_bytes=huge_page_size_bytes,
            disks=disks,
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
