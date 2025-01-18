from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar, cast

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
        cached_builds (List[str]): List of cached builds id on the node
        node_id (str): Identifier of the node
        sandboxes (List['RunningSandbox']): List of sandboxes running on the node
        status (NodeStatus): Status of the node
    """

    cached_builds: List[str]
    node_id: str
    sandboxes: List["RunningSandbox"]
    status: NodeStatus
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        cached_builds = self.cached_builds

        node_id = self.node_id

        sandboxes = []
        for sandboxes_item_data in self.sandboxes:
            sandboxes_item = sandboxes_item_data.to_dict()
            sandboxes.append(sandboxes_item)

        status = self.status.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cachedBuilds": cached_builds,
                "nodeID": node_id,
                "sandboxes": sandboxes,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.running_sandbox import RunningSandbox

        d = src_dict.copy()
        cached_builds = cast(List[str], d.pop("cachedBuilds"))

        node_id = d.pop("nodeID")

        sandboxes = []
        _sandboxes = d.pop("sandboxes")
        for sandboxes_item_data in _sandboxes:
            sandboxes_item = RunningSandbox.from_dict(sandboxes_item_data)

            sandboxes.append(sandboxes_item)

        status = NodeStatus(d.pop("status"))

        node_detail = cls(
            cached_builds=cached_builds,
            node_id=node_id,
            sandboxes=sandboxes,
            status=status,
        )

        node_detail.additional_properties = d
        return node_detail

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
