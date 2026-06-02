from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AdminBuildCancelResult")


@_attrs_define
class AdminBuildCancelResult:
    """
    Attributes:
        cancelled_count (int): Number of builds successfully cancelled
        failed_count (int): Number of builds that failed to cancel
    """

    cancelled_count: int
    failed_count: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cancelled_count = self.cancelled_count

        failed_count = self.failed_count

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cancelledCount": cancelled_count,
                "failedCount": failed_count,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        cancelled_count = d.pop("cancelledCount")

        failed_count = d.pop("failedCount")

        admin_build_cancel_result = cls(
            cancelled_count=cancelled_count,
            failed_count=failed_count,
        )

        admin_build_cancel_result.additional_properties = d
        return admin_build_cancel_result

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
