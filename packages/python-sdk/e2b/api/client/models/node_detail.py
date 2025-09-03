from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus

if TYPE_CHECKING:
    from ..models.listed_sandbox import ListedSandbox
    from ..models.node_metrics import NodeMetrics


T = TypeVar("T", bound="NodeDetail")


@_attrs_define
class NodeDetail:
    """
    Attributes:
        cached_builds (list[str]): List of cached builds id on the node
        cluster_id (str): Identifier of the cluster
        commit (str): Commit of the orchestrator
        create_fails (int): Number of sandbox create fails
        create_successes (int): Number of sandbox create successes
        id (str): Identifier of the node
        metrics (NodeMetrics): Node metrics
        node_id (str): Identifier of the nomad node
        sandboxes (list['ListedSandbox']): List of sandboxes running on the node
        service_instance_id (str): Service instance identifier of the node
        status (NodeStatus): Status of the node
        version (str): Version of the orchestrator
    """

    cached_builds: list[str]
    cluster_id: str
    commit: str
    create_fails: int
    create_successes: int
    id: str
    metrics: "NodeMetrics"
    node_id: str
    sandboxes: list["ListedSandbox"]
    service_instance_id: str
    status: NodeStatus
    version: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cached_builds = self.cached_builds

        cluster_id = self.cluster_id

        commit = self.commit

        create_fails = self.create_fails

        create_successes = self.create_successes

        id = self.id

        metrics = self.metrics.to_dict()

        node_id = self.node_id

        sandboxes = []
        for sandboxes_item_data in self.sandboxes:
            sandboxes_item = sandboxes_item_data.to_dict()
            sandboxes.append(sandboxes_item)

        service_instance_id = self.service_instance_id

        status = self.status.value

        version = self.version

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cachedBuilds": cached_builds,
                "clusterID": cluster_id,
                "commit": commit,
                "createFails": create_fails,
                "createSuccesses": create_successes,
                "id": id,
                "metrics": metrics,
                "nodeID": node_id,
                "sandboxes": sandboxes,
                "serviceInstanceID": service_instance_id,
                "status": status,
                "version": version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.listed_sandbox import ListedSandbox
        from ..models.node_metrics import NodeMetrics

        d = dict(src_dict)
        cached_builds = cast(list[str], d.pop("cachedBuilds"))

        cluster_id = d.pop("clusterID")

        commit = d.pop("commit")

        create_fails = d.pop("createFails")

        create_successes = d.pop("createSuccesses")

        id = d.pop("id")

        metrics = NodeMetrics.from_dict(d.pop("metrics"))

        node_id = d.pop("nodeID")

        sandboxes = []
        _sandboxes = d.pop("sandboxes")
        for sandboxes_item_data in _sandboxes:
            sandboxes_item = ListedSandbox.from_dict(sandboxes_item_data)

            sandboxes.append(sandboxes_item)

        service_instance_id = d.pop("serviceInstanceID")

        status = NodeStatus(d.pop("status"))

        version = d.pop("version")

        node_detail = cls(
            cached_builds=cached_builds,
            cluster_id=cluster_id,
            commit=commit,
            create_fails=create_fails,
            create_successes=create_successes,
            id=id,
            metrics=metrics,
            node_id=node_id,
            sandboxes=sandboxes,
            service_instance_id=service_instance_id,
            status=status,
            version=version,
        )

        node_detail.additional_properties = d
        return node_detail

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
