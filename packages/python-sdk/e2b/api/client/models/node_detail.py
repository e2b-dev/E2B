import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.node_status import NodeStatus

if TYPE_CHECKING:
    from ..models.machine_info import MachineInfo
    from ..models.node_metrics import NodeMetrics


T = TypeVar("T", bound="NodeDetail")


@_attrs_define
class NodeDetail:
    """
    Attributes:
        cluster_id (str): Identifier of the cluster
        version (str): Version of the orchestrator
        commit (str): Commit of the orchestrator
        id (str): Identifier of the node
        service_instance_id (str): Service instance identifier of the node
        machine_info (MachineInfo):
        status (NodeStatus): Status of the node.
            - draining: the node is bound to be shut down. It will not accept new sandboxes and will stop once all existing
            sandboxes are done.
            - standby: the node is not actively used, but it can return to ready and continue serving traffic.
        status_changed_at (datetime.datetime): Time when the node status was last changed
        sandbox_count (int): Number of sandboxes running on the node
        metrics (NodeMetrics): Node metrics
        cached_builds (list[str]): List of cached builds id on the node
        create_successes (int): Number of sandbox create successes
        create_fails (int): Number of sandbox create fails
    """

    cluster_id: str
    version: str
    commit: str
    id: str
    service_instance_id: str
    machine_info: "MachineInfo"
    status: NodeStatus
    status_changed_at: datetime.datetime
    sandbox_count: int
    metrics: "NodeMetrics"
    cached_builds: list[str]
    create_successes: int
    create_fails: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cluster_id = self.cluster_id

        version = self.version

        commit = self.commit

        id = self.id

        service_instance_id = self.service_instance_id

        machine_info = self.machine_info.to_dict()

        status = self.status.value

        status_changed_at = self.status_changed_at.isoformat()

        sandbox_count = self.sandbox_count

        metrics = self.metrics.to_dict()

        cached_builds = self.cached_builds

        create_successes = self.create_successes

        create_fails = self.create_fails

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clusterID": cluster_id,
                "version": version,
                "commit": commit,
                "id": id,
                "serviceInstanceID": service_instance_id,
                "machineInfo": machine_info,
                "status": status,
                "statusChangedAt": status_changed_at,
                "sandboxCount": sandbox_count,
                "metrics": metrics,
                "cachedBuilds": cached_builds,
                "createSuccesses": create_successes,
                "createFails": create_fails,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.machine_info import MachineInfo
        from ..models.node_metrics import NodeMetrics

        d = dict(src_dict)
        cluster_id = d.pop("clusterID")

        version = d.pop("version")

        commit = d.pop("commit")

        id = d.pop("id")

        service_instance_id = d.pop("serviceInstanceID")

        machine_info = MachineInfo.from_dict(d.pop("machineInfo"))

        status = NodeStatus(d.pop("status"))

        status_changed_at = isoparse(d.pop("statusChangedAt"))

        sandbox_count = d.pop("sandboxCount")

        metrics = NodeMetrics.from_dict(d.pop("metrics"))

        cached_builds = cast(list[str], d.pop("cachedBuilds"))

        create_successes = d.pop("createSuccesses")

        create_fails = d.pop("createFails")

        node_detail = cls(
            cluster_id=cluster_id,
            version=version,
            commit=commit,
            id=id,
            service_instance_id=service_instance_id,
            machine_info=machine_info,
            status=status,
            status_changed_at=status_changed_at,
            sandbox_count=sandbox_count,
            metrics=metrics,
            cached_builds=cached_builds,
            create_successes=create_successes,
            create_fails=create_fails,
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
