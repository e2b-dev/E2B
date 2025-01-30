from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus

T = TypeVar("T", bound="Node")


@_attrs_define
class Node:
    """
    Attributes:
        node_id (str): Identifier of the node
        status (NodeStatus): Status of the node
        sandbox_count (int): Number of sandboxes running on the node
        allocated_cpu (int): Number of allocated CPU cores
        allocated_memory_mi_b (int): Amount of allocated memory in MiB
    """

    node_id: str
    status: NodeStatus
    sandbox_count: int
    allocated_cpu: int
    allocated_memory_mi_b: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        node_id = self.node_id

        status = self.status.value

        sandbox_count = self.sandbox_count

        allocated_cpu = self.allocated_cpu

        allocated_memory_mi_b = self.allocated_memory_mi_b

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "nodeID": node_id,
                "status": status,
                "sandboxCount": sandbox_count,
                "allocatedCPU": allocated_cpu,
                "allocatedMemoryMiB": allocated_memory_mi_b,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        node_id = d.pop("nodeID")

        status = NodeStatus(d.pop("status"))

        sandbox_count = d.pop("sandboxCount")

        allocated_cpu = d.pop("allocatedCPU")

        allocated_memory_mi_b = d.pop("allocatedMemoryMiB")

        node = cls(
            node_id=node_id,
            status=status,
            sandbox_count=sandbox_count,
            allocated_cpu=allocated_cpu,
            allocated_memory_mi_b=allocated_memory_mi_b,
        )

        node.additional_properties = d
        return node

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
