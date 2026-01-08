from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AdminSandboxKillResult")


@_attrs_define
class AdminSandboxKillResult:
    """
    Attributes:
        failed_count (int): Number of sandboxes that failed to kill
        killed_count (int): Number of sandboxes successfully killed
    """

    failed_count: int
    killed_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        failed_count = self.failed_count

        killed_count = self.killed_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "failedCount": failed_count,
                "killedCount": killed_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        failed_count = d.pop("failedCount")

        killed_count = d.pop("killedCount")

        admin_sandbox_kill_result = cls(
            failed_count=failed_count,
            killed_count=killed_count,
        )

        admin_sandbox_kill_result.additional_properties = d
        return admin_sandbox_kill_result

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
