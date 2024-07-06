from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.sandbox_log import SandboxLog


T = TypeVar("T", bound="SandboxLogs")


@_attrs_define
class SandboxLogs:
    """
    Attributes:
        logs (List['SandboxLog']): Logs of the sandbox
    """

    logs: List["SandboxLog"]
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        logs = []
        for logs_item_data in self.logs:
            logs_item = logs_item_data.to_dict()
            logs.append(logs_item)

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "logs": logs,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.sandbox_log import SandboxLog

        d = src_dict.copy()
        logs = []
        _logs = d.pop("logs")
        for logs_item_data in _logs:
            logs_item = SandboxLog.from_dict(logs_item_data)

            logs.append(logs_item)

        sandbox_logs = cls(
            logs=logs,
        )

        sandbox_logs.additional_properties = d
        return sandbox_logs

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
