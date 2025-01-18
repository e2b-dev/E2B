from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus

T = TypeVar("T", bound="Node")


@_attrs_define
class Node:
    """
    Attributes:
        allocated_cpu (int): Number of allocated CPU cores
        allocated_memory_mi_b (int): Amount of allocated memory in MiB
        node_id (str): Identifier of the node
        sandbox_count (int): Number of sandboxes running on the node
        status (NodeStatus): Status of the node
    """

    allocated_cpu: int
    allocated_memory_mi_b: int
    node_id: str
    sandbox_count: int
    status: NodeStatus
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        allocated_cpu = self.allocated_cpu

        allocated_memory_mi_b = self.allocated_memory_mi_b

        node_id = self.node_id

        sandbox_count = self.sandbox_count

        status = self.status.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "allocatedCPU": allocated_cpu,
                "allocatedMemoryMiB": allocated_memory_mi_b,
                "nodeID": node_id,
                "sandboxCount": sandbox_count,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        allocated_cpu = d.pop("allocatedCPU")

        allocated_memory_mi_b = d.pop("allocatedMemoryMiB")

        node_id = d.pop("nodeID")

        sandbox_count = d.pop("sandboxCount")

        status = NodeStatus(d.pop("status"))

        node = cls(
            allocated_cpu=allocated_cpu,
            allocated_memory_mi_b=allocated_memory_mi_b,
            node_id=node_id,
            sandbox_count=sandbox_count,
            status=status,
        )

        node.additional_properties = d
        return node

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
