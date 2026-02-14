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
        fields (SandboxLogEntryFields):
        level (LogLevel): State of the sandbox
        message (str): Log message content
        timestamp (datetime.datetime): Timestamp of the log entry
    """

    fields: "SandboxLogEntryFields"
    level: LogLevel
    message: str
    timestamp: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        fields = self.fields.to_dict()

        level = self.level.value

        message = self.message

        timestamp = self.timestamp.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "fields": fields,
                "level": level,
                "message": message,
                "timestamp": timestamp,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_log_entry_fields import SandboxLogEntryFields

        d = dict(src_dict)
        fields = SandboxLogEntryFields.from_dict(d.pop("fields"))

        level = LogLevel(d.pop("level"))

        message = d.pop("message")

        timestamp = isoparse(d.pop("timestamp"))

        sandbox_log_entry = cls(
            fields=fields,
            level=level,
            message=message,
            timestamp=timestamp,
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
