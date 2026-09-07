from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ResumedSandbox")


@_attrs_define
class ResumedSandbox:
    """
    Attributes:
        timeout (Union[Unset, int]): Time to live for the sandbox in seconds. Default: 15.
        auto_pause (Union[Unset, bool]): Automatically pauses the sandbox after the timeout
        memory (Union[Unset, bool]): Defaults to true. When false, resume from disk state only: the sandbox cold-boots
            fresh and any memory in the snapshot is ignored, never modified or deleted. Disk state has crash-recovery
            semantics — writes not flushed before the pause may be lost. A no-op for snapshots that contain no memory.
            Rejected with an error in environments where this capability is not enabled, never silently downgraded to a
            memory restore.
    """

    timeout: Union[Unset, int] = 15
    auto_pause: Union[Unset, bool] = UNSET
    memory: Union[Unset, bool] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timeout = self.timeout

        auto_pause = self.auto_pause

        memory = self.memory

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if timeout is not UNSET:
            field_dict["timeout"] = timeout
        if auto_pause is not UNSET:
            field_dict["autoPause"] = auto_pause
        if memory is not UNSET:
            field_dict["memory"] = memory

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        timeout = d.pop("timeout", UNSET)

        auto_pause = d.pop("autoPause", UNSET)

        memory = d.pop("memory", UNSET)

        resumed_sandbox = cls(
            timeout=timeout,
            auto_pause=auto_pause,
            memory=memory,
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
