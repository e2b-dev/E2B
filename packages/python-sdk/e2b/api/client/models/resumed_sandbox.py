from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Union


T = TypeVar("T", bound="ResumedSandbox")


@_attrs_define
class ResumedSandbox:
    """
    Attributes:
        timeout (Union[Unset, int]): Time to live for the sandbox in seconds. Default: 15.
        auto_pause (Union[Unset, bool]): Automatically pauses the sandbox after the timeout Default: False.
    """

    timeout: Union[Unset, int] = 15
    auto_pause: Union[Unset, bool] = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timeout = self.timeout

        auto_pause = self.auto_pause

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if timeout is not UNSET:
            field_dict["timeout"] = timeout
        if auto_pause is not UNSET:
            field_dict["autoPause"] = auto_pause

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        timeout = d.pop("timeout", UNSET)

        auto_pause = d.pop("autoPause", UNSET)

        resumed_sandbox = cls(
            timeout=timeout,
            auto_pause=auto_pause,
        )

        resumed_sandbox.additional_properties = d
        return resumed_sandbox

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
