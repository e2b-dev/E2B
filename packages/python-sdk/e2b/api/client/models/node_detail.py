from typing import TYPE_CHECKING, Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.node_status import NodeStatus

if TYPE_CHECKING:
    from ..models.running_sandbox import RunningSandbox


T = TypeVar("T", bound="NodeDetail")


@_attrs_define
class NodeDetail:
    """
    Attributes:
        node_id (str): Identifier of the node
        status (NodeStatus): Status of the node
        sandboxes (list['RunningSandbox']): List of sandboxes running on the node
        cached_builds (list[str]): List of cached builds id on the node
    """

    node_id: str
    status: NodeStatus
    sandboxes: list["RunningSandbox"]
    cached_builds: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        node_id = self.node_id

        status = self.status.value

        sandboxes = []
        for sandboxes_item_data in self.sandboxes:
            sandboxes_item = sandboxes_item_data.to_dict()
            sandboxes.append(sandboxes_item)

        cached_builds = self.cached_builds

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "nodeID": node_id,
                "status": status,
                "sandboxes": sandboxes,
                "cachedBuilds": cached_builds,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        from ..models.running_sandbox import RunningSandbox

        d = src_dict.copy()
        node_id = d.pop("nodeID")

        status = NodeStatus(d.pop("status"))

        sandboxes = []
        _sandboxes = d.pop("sandboxes")
        for sandboxes_item_data in _sandboxes:
            sandboxes_item = RunningSandbox.from_dict(sandboxes_item_data)

            sandboxes.append(sandboxes_item)

        cached_builds = cast(list[str], d.pop("cachedBuilds"))

        node_detail = cls(
            node_id=node_id,
            status=status,
            sandboxes=sandboxes,
            cached_builds=cached_builds,
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
