import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="MaxTeamMetric")


@_attrs_define
class MaxTeamMetric:
    """Team metric with timestamp

    Attributes:
        timestamp (datetime.datetime): Timestamp of the metric entry
        timestamp_unix (int): Timestamp of the metric entry in Unix time (seconds since epoch)
        value (float): The maximum value of the requested metric in the given interval
    """

    timestamp: datetime.datetime
    timestamp_unix: int
    value: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timestamp = self.timestamp.isoformat()

        timestamp_unix = self.timestamp_unix

        value = self.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timestamp": timestamp,
                "timestampUnix": timestamp_unix,
                "value": value,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        timestamp = isoparse(d.pop("timestamp"))

        timestamp_unix = d.pop("timestampUnix")

        value = d.pop("value")

        max_team_metric = cls(
            timestamp=timestamp,
            timestamp_unix=timestamp_unix,
            value=value,
        )

        max_team_metric.additional_properties = d
        return max_team_metric

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
