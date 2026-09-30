from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="ConnectSandboxV2")


@_attrs_define
class ConnectSandboxV2:
    """
    Attributes:
        timeout (Union[Unset, int]): Timeout in seconds from the current time after which the sandbox should expire
            Default: 300.
        memory (Union[Unset, bool]): Defaults to true. When false and the sandbox is paused, resume from disk state
            only: the sandbox cold-boots fresh and any memory in the snapshot is ignored, never modified or deleted. Disk
            state has crash-recovery semantics — writes not flushed before the pause may be lost. A no-op for snapshots that
            contain no memory. Rejected with an error in environments where this capability is not enabled, never silently
            downgraded to a memory restore.
    """

    timeout: Union[Unset, int] = 300
    memory: Union[Unset, bool] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timeout = self.timeout

        memory = self.memory

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if timeout is not UNSET:
            field_dict["timeout"] = timeout
        if memory is not UNSET:
            field_dict["memory"] = memory

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        timeout = d.pop("timeout", UNSET)

        memory = d.pop("memory", UNSET)

        connect_sandbox_v2 = cls(
            timeout=timeout,
            memory=memory,
        )

        connect_sandbox_v2.additional_properties = d
        return connect_sandbox_v2

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
