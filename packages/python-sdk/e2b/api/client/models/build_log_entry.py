import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.log_level import LogLevel

T = TypeVar("T", bound="BuildLogEntry")


@_attrs_define
class BuildLogEntry:
    """
    Attributes:
        level (LogLevel): State of the sandbox
        message (str): Log message content
        timestamp (datetime.datetime): Timestamp of the log entry
    """

    level: LogLevel
    message: str
    timestamp: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        level = self.level.value

        message = self.message

        timestamp = self.timestamp.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "level": level,
                "message": message,
                "timestamp": timestamp,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        level = LogLevel(d.pop("level"))

        message = d.pop("message")

        timestamp = isoparse(d.pop("timestamp"))

        build_log_entry = cls(
            level=level,
            message=message,
            timestamp=timestamp,
        )

        build_log_entry.additional_properties = d
        return build_log_entry

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
