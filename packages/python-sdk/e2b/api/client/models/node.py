from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus

if TYPE_CHECKING:
    from ..models.node_metrics import NodeMetrics


T = TypeVar("T", bound="Node")


@_attrs_define
class Node:
    """
    Attributes:
        cluster_id (str): Identifier of the cluster
        commit (str): Commit of the orchestrator
        create_fails (int): Number of sandbox create fails
        create_successes (int): Number of sandbox create successes
        id (str): Identifier of the node
        metrics (NodeMetrics): Node metrics
        node_id (str): Identifier of the nomad node
        sandbox_count (int): Number of sandboxes running on the node
        sandbox_starting_count (int): Number of starting Sandboxes
        service_instance_id (str): Service instance identifier of the node
        status (NodeStatus): Status of the node
        version (str): Version of the orchestrator
    """

    cluster_id: str
    commit: str
    create_fails: int
    create_successes: int
    id: str
    metrics: "NodeMetrics"
    node_id: str
    sandbox_count: int
    sandbox_starting_count: int
    service_instance_id: str
    status: NodeStatus
    version: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cluster_id = self.cluster_id

        commit = self.commit

        create_fails = self.create_fails

        create_successes = self.create_successes

        id = self.id

        metrics = self.metrics.to_dict()

        node_id = self.node_id

        sandbox_count = self.sandbox_count

        sandbox_starting_count = self.sandbox_starting_count

        service_instance_id = self.service_instance_id

        status = self.status.value

        version = self.version

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clusterID": cluster_id,
                "commit": commit,
                "createFails": create_fails,
                "createSuccesses": create_successes,
                "id": id,
                "metrics": metrics,
                "nodeID": node_id,
                "sandboxCount": sandbox_count,
                "sandboxStartingCount": sandbox_starting_count,
                "serviceInstanceID": service_instance_id,
                "status": status,
                "version": version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.node_metrics import NodeMetrics

        d = dict(src_dict)
        cluster_id = d.pop("clusterID")

        commit = d.pop("commit")

        create_fails = d.pop("createFails")

        create_successes = d.pop("createSuccesses")

        id = d.pop("id")

        metrics = NodeMetrics.from_dict(d.pop("metrics"))

        node_id = d.pop("nodeID")

        sandbox_count = d.pop("sandboxCount")

        sandbox_starting_count = d.pop("sandboxStartingCount")

        service_instance_id = d.pop("serviceInstanceID")

        status = NodeStatus(d.pop("status"))

        version = d.pop("version")

        node = cls(
            cluster_id=cluster_id,
            commit=commit,
            create_fails=create_fails,
            create_successes=create_successes,
            id=id,
            metrics=metrics,
            node_id=node_id,
            sandbox_count=sandbox_count,
            sandbox_starting_count=sandbox_starting_count,
            service_instance_id=service_instance_id,
            status=status,
            version=version,
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
