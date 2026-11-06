from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxPauseRequest")


@_attrs_define
class SandboxPauseRequest:
    """
    Attributes:
        memory (Union[Unset, bool]): Whether to capture a full memory snapshot. When false, only the filesystem is
            persisted and resuming the sandbox cold-boots (reboots) it from disk, losing in-memory state, running processes,
            and open connections. Resume it with an explicit request (connect or resume); auto-resume, which can be
            triggered by arbitrary traffic, refuses such a sandbox. Defaults to true. Default: True.
        require_healthy_guest (Union[Unset, bool]): The pause checks that the sandbox guest agent answers before it
            takes the snapshot. By default an unresponsive agent is recorded on the snapshot and the pause proceeds; the
            sandbox then shows `envdUnresponsiveAtPause` and a later resume must ask for `memory: false`, since restoring
            that memory would bring the unresponsive agent back. With this true, the pause is instead refused with 503 while
            the agent does not answer, and the sandbox keeps running. A filesystem-only pause (`memory: false`) is always
            refused while the agent does not answer, whatever this says. Default: False.
    """

    memory: Union[Unset, bool] = True
    require_healthy_guest: Union[Unset, bool] = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        memory = self.memory

        require_healthy_guest = self.require_healthy_guest

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if memory is not UNSET:
            field_dict["memory"] = memory
        if require_healthy_guest is not UNSET:
            field_dict["requireHealthyGuest"] = require_healthy_guest

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        memory = d.pop("memory", UNSET)

        require_healthy_guest = d.pop("requireHealthyGuest", UNSET)

        sandbox_pause_request = cls(
            memory=memory,
            require_healthy_guest=require_healthy_guest,
        )

        sandbox_pause_request.additional_properties = d
        return sandbox_pause_request

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
