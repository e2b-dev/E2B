from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.listed_sandbox import ListedSandbox


T = TypeVar("T", bound="NodeDetail")


@_attrs_define
class NodeDetail:
    """
    Attributes:
        cached_builds (list[str]): List of cached builds id on the node
        commit (str): Commit of the orchestrator
        create_fails (int): Number of sandbox create fails
        create_successes (int): Number of sandbox create successes
        node_id (str): Identifier of the node
        sandboxes (list['ListedSandbox']): List of sandboxes running on the node
        status (NodeStatus): Status of the node
        version (str): Version of the orchestrator
        cluster_id (Union[None, Unset, str]): Identifier of the cluster
    """

    cached_builds: list[str]
    commit: str
    create_fails: int
    create_successes: int
    node_id: str
    sandboxes: list["ListedSandbox"]
    status: NodeStatus
    version: str
    cluster_id: Union[None, Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cached_builds = self.cached_builds

        commit = self.commit

        create_fails = self.create_fails

        create_successes = self.create_successes

        node_id = self.node_id

        sandboxes = []
        for sandboxes_item_data in self.sandboxes:
            sandboxes_item = sandboxes_item_data.to_dict()
            sandboxes.append(sandboxes_item)

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
                "cachedBuilds": cached_builds,
                "commit": commit,
                "createFails": create_fails,
                "createSuccesses": create_successes,
                "nodeID": node_id,
                "sandboxes": sandboxes,
                "status": status,
                "version": version,
            }
        )
        if cluster_id is not UNSET:
            field_dict["clusterID"] = cluster_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.listed_sandbox import ListedSandbox

        d = dict(src_dict)
        cached_builds = cast(list[str], d.pop("cachedBuilds"))

        commit = d.pop("commit")

        create_fails = d.pop("createFails")

        create_successes = d.pop("createSuccesses")

        node_id = d.pop("nodeID")

        sandboxes = []
        _sandboxes = d.pop("sandboxes")
        for sandboxes_item_data in _sandboxes:
            sandboxes_item = ListedSandbox.from_dict(sandboxes_item_data)

            sandboxes.append(sandboxes_item)

        status = NodeStatus(d.pop("status"))

        version = d.pop("version")

        def _parse_cluster_id(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        cluster_id = _parse_cluster_id(d.pop("clusterID", UNSET))

        node_detail = cls(
            cached_builds=cached_builds,
            commit=commit,
            create_fails=create_fails,
            create_successes=create_successes,
            node_id=node_id,
            sandboxes=sandboxes,
            status=status,
            version=version,
            cluster_id=cluster_id,
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
