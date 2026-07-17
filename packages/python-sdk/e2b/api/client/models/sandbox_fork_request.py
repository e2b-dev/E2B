from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxForkRequest")


@_attrs_define
class SandboxForkRequest:
    """
    Attributes:
        count (Union[Unset, int]): Number of forked sandboxes to create. All forks boot from the same snapshot, so the
            snapshot is captured once regardless of count. Each fork succeeds or fails independently; the outcome of each is
            reported in its entry of the response list. Default: 1.
        timeout (Union[Unset, int]): Time to live for the new forked sandboxes in seconds. Default: 15.
    """

    count: Union[Unset, int] = 1
    timeout: Union[Unset, int] = 15
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        count = self.count

        timeout = self.timeout

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if count is not UNSET:
            field_dict["count"] = count
        if timeout is not UNSET:
            field_dict["timeout"] = timeout

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        count = d.pop("count", UNSET)

        timeout = d.pop("timeout", UNSET)

        sandbox_fork_request = cls(
            count=count,
            timeout=timeout,
        )

        sandbox_fork_request.additional_properties = d
        return sandbox_fork_request

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
