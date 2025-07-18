from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="Node")


@_attrs_define
class Node:
    """
    Attributes:
        allocated_cpu (int): Number of allocated CPU cores
        allocated_memory_mi_b (int): Amount of allocated memory in MiB
        commit (str): Commit of the orchestrator
        create_fails (int): Number of sandbox create fails
        create_successes (int): Number of sandbox create successes
        node_id (str): Identifier of the node
        sandbox_count (int): Number of sandboxes running on the node
        sandbox_starting_count (int): Number of starting Sandboxes
        status (NodeStatus): Status of the node
        version (str): Version of the orchestrator
        cluster_id (Union[None, Unset, str]): Identifier of the cluster
    """

    allocated_cpu: int
    allocated_memory_mi_b: int
    commit: str
    create_fails: int
    create_successes: int
    node_id: str
    sandbox_count: int
    sandbox_starting_count: int
    status: NodeStatus
    version: str
    cluster_id: Union[None, Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        allocated_cpu = self.allocated_cpu

        allocated_memory_mi_b = self.allocated_memory_mi_b

        commit = self.commit

        create_fails = self.create_fails

        create_successes = self.create_successes

        node_id = self.node_id

        sandbox_count = self.sandbox_count

        sandbox_starting_count = self.sandbox_starting_count

        status = self.status.value

        version = self.version

        cluster_id: Union[None, Unset, str]
        if isinstance(self.cluster_id, Unset):
            cluster_id = UNSET
        else:
            cluster_id = self.cluster_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "allocatedCPU": allocated_cpu,
                "allocatedMemoryMiB": allocated_memory_mi_b,
                "commit": commit,
                "createFails": create_fails,
                "createSuccesses": create_successes,
                "nodeID": node_id,
                "sandboxCount": sandbox_count,
                "sandboxStartingCount": sandbox_starting_count,
                "status": status,
                "version": version,
            }
        )
        if cluster_id is not UNSET:
            field_dict["clusterID"] = cluster_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        allocated_cpu = d.pop("allocatedCPU")

        allocated_memory_mi_b = d.pop("allocatedMemoryMiB")

        commit = d.pop("commit")

        create_fails = d.pop("createFails")

        create_successes = d.pop("createSuccesses")

        node_id = d.pop("nodeID")

        sandbox_count = d.pop("sandboxCount")

        sandbox_starting_count = d.pop("sandboxStartingCount")

        status = NodeStatus(d.pop("status"))

        version = d.pop("version")

        def _parse_cluster_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        cluster_id = _parse_cluster_id(d.pop("clusterID", UNSET))

        node = cls(
            allocated_cpu=allocated_cpu,
            allocated_memory_mi_b=allocated_memory_mi_b,
            commit=commit,
            create_fails=create_fails,
            create_successes=create_successes,
            node_id=node_id,
            sandbox_count=sandbox_count,
            sandbox_starting_count=sandbox_starting_count,
            status=status,
            version=version,
            cluster_id=cluster_id,
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
