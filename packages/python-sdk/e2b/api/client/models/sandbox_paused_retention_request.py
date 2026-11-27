from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="SandboxPausedRetentionRequest")


@_attrs_define
class SandboxPausedRetentionRequest:
    """
    Attributes:
        paused_retention_seconds (Union[None, int]): Seconds a paused sandbox may stay unused before it is deleted, from
            1 hour to 100 years. The clock restarts every time a run of the sandbox ends, by pause or by kill. Null means
            the sandbox is never deleted automatically.
    """

    paused_retention_seconds: Union[None, int]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        paused_retention_seconds: Union[None, int]
        paused_retention_seconds = self.paused_retention_seconds

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "pausedRetentionSeconds": paused_retention_seconds,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)

        def _parse_paused_retention_seconds(data: object) -> Union[None, int]:
            if data is None:
                return data
            return cast(Union[None, int], data)

        paused_retention_seconds = _parse_paused_retention_seconds(
            d.pop("pausedRetentionSeconds")
        )

        sandbox_paused_retention_request = cls(
            paused_retention_seconds=paused_retention_seconds,
        )

        sandbox_paused_retention_request.additional_properties = d
        return sandbox_paused_retention_request

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
