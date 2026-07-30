import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.log_level import LogLevel
from ..types import UNSET, Unset

T = TypeVar("T", bound="BuildLogEntry")


@_attrs_define
class BuildLogEntry:
    """
    Attributes:
        timestamp (datetime.datetime): Timestamp of the log entry
        message (str): Log message content
        level (LogLevel): State of the sandbox
        step (Union[Unset, str]): Step in the build process related to the log entry
    """

    timestamp: datetime.datetime
    message: str
    level: LogLevel
    step: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timestamp = self.timestamp.isoformat()

        message = self.message

        level = self.level.value

        step = self.step

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timestamp": timestamp,
                "message": message,
                "level": level,
            }
        )
        if step is not UNSET:
            field_dict["step"] = step

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        timestamp = isoparse(d.pop("timestamp"))

        message = d.pop("message")

        level = LogLevel(d.pop("level"))

        step = d.pop("step", UNSET)

        build_log_entry = cls(
            timestamp=timestamp,
            message=message,
            level=level,
            step=step,
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
