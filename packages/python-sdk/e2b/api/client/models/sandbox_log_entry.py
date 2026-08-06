import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.log_level import LogLevel

if TYPE_CHECKING:
    from ..models.sandbox_log_entry_fields import SandboxLogEntryFields


T = TypeVar("T", bound="SandboxLogEntry")


@_attrs_define
class SandboxLogEntry:
    """
    Attributes:
        timestamp (datetime.datetime): Timestamp of the log entry
        message (str): Log message content
        level (LogLevel): State of the sandbox
        fields (SandboxLogEntryFields):
    """

    timestamp: datetime.datetime
    message: str
    level: LogLevel
    fields: "SandboxLogEntryFields"
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timestamp = self.timestamp.isoformat()

        message = self.message

        level = self.level.value

        fields = self.fields.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timestamp": timestamp,
                "message": message,
                "level": level,
                "fields": fields,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_log_entry_fields import SandboxLogEntryFields

        d = dict(src_dict)
        timestamp = isoparse(d.pop("timestamp"))

        message = d.pop("message")

        level = LogLevel(d.pop("level"))

        fields = SandboxLogEntryFields.from_dict(d.pop("fields"))

        sandbox_log_entry = cls(
            timestamp=timestamp,
            message=message,
            level=level,
            fields=fields,
        )

        sandbox_log_entry.additional_properties = d
        return sandbox_log_entry

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
