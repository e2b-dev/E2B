from collections.abc import Mapping
from typing import Any, TypeVar, Union
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="NodeStatusChange")


@_attrs_define
class NodeStatusChange:
    """
    Attributes:
        status (NodeStatus): Status of the node
        cluster_id (Union[Unset, UUID]): Identifier of the cluster
    """

    status: NodeStatus
    cluster_id: Union[Unset, UUID] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        cluster_id: Union[Unset, str] = UNSET
        if not isinstance(self.cluster_id, Unset):
            cluster_id = str(self.cluster_id)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "status": status,
            }
        )
        if cluster_id is not UNSET:
            field_dict["clusterID"] = cluster_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = NodeStatus(d.pop("status"))

        _cluster_id = d.pop("clusterID", UNSET)
        cluster_id: Union[Unset, UUID]
        if isinstance(_cluster_id, Unset):
            cluster_id = UNSET
        else:
            cluster_id = UUID(_cluster_id)

        node_status_change = cls(
            status=status,
            cluster_id=cluster_id,
        )

        node_status_change.additional_properties = d
        return node_status_change

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
