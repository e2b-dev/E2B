import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="TeamMetric")


@_attrs_define
class TeamMetric:
    """Team metric with timestamp

    Attributes:
        concurrent_sandboxes (int): The number of concurrent sandboxes for the team
        sandbox_start_rate (float): Number of sandboxes started per second
        timestamp (datetime.datetime): Timestamp of the metric entry
        timestamp_unix (int): Timestamp of the metric entry in Unix time (seconds since epoch)
    """

    concurrent_sandboxes: int
    sandbox_start_rate: float
    timestamp: datetime.datetime
    timestamp_unix: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        concurrent_sandboxes = self.concurrent_sandboxes

        sandbox_start_rate = self.sandbox_start_rate

        timestamp = self.timestamp.isoformat()

        timestamp_unix = self.timestamp_unix

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "concurrentSandboxes": concurrent_sandboxes,
                "sandboxStartRate": sandbox_start_rate,
                "timestamp": timestamp,
                "timestampUnix": timestamp_unix,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        concurrent_sandboxes = d.pop("concurrentSandboxes")

        sandbox_start_rate = d.pop("sandboxStartRate")

        timestamp = isoparse(d.pop("timestamp"))

        timestamp_unix = d.pop("timestampUnix")

        team_metric = cls(
            concurrent_sandboxes=concurrent_sandboxes,
            sandbox_start_rate=sandbox_start_rate,
            timestamp=timestamp,
            timestamp_unix=timestamp_unix,
        )

        team_metric.additional_properties = d
        return team_metric

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
