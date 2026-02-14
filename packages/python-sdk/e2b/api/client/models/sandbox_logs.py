from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.sandbox_log import SandboxLog
    from ..models.sandbox_log_entry import SandboxLogEntry


T = TypeVar("T", bound="SandboxLogs")


@_attrs_define
class SandboxLogs:
    """
    Attributes:
        log_entries (list['SandboxLogEntry']): Structured logs of the sandbox
        logs (list['SandboxLog']): Logs of the sandbox
    """

    log_entries: list["SandboxLogEntry"]
    logs: list["SandboxLog"]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        log_entries = []
        for log_entries_item_data in self.log_entries:
            log_entries_item = log_entries_item_data.to_dict()
            log_entries.append(log_entries_item)

        logs = []
        for logs_item_data in self.logs:
            logs_item = logs_item_data.to_dict()
            logs.append(logs_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "logEntries": log_entries,
                "logs": logs,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_log import SandboxLog
        from ..models.sandbox_log_entry import SandboxLogEntry

        d = dict(src_dict)
        log_entries = []
        _log_entries = d.pop("logEntries")
        for log_entries_item_data in _log_entries:
            log_entries_item = SandboxLogEntry.from_dict(log_entries_item_data)

            log_entries.append(log_entries_item)

        logs = []
        _logs = d.pop("logs")
        for logs_item_data in _logs:
            logs_item = SandboxLog.from_dict(logs_item_data)

            logs.append(logs_item)

        sandbox_logs = cls(
            log_entries=log_entries,
            logs=logs,
        )

        sandbox_logs.additional_properties = d
        return sandbox_logs

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
