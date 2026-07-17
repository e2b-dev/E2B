from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.error import Error
    from ..models.sandbox import Sandbox


T = TypeVar("T", bound="SandboxForkResult")


@_attrs_define
class SandboxForkResult:
    """Result of one requested fork. Exactly one of sandbox or error is set: sandbox when the fork started successfully,
    error when it failed to start.

        Attributes:
            error (Union[Unset, Error]):
            sandbox (Union[Unset, Sandbox]):
    """

    error: Union[Unset, "Error"] = UNSET
    sandbox: Union[Unset, "Sandbox"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        error: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.error, Unset):
            error = self.error.to_dict()

        sandbox: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.sandbox, Unset):
            sandbox = self.sandbox.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if error is not UNSET:
            field_dict["error"] = error
        if sandbox is not UNSET:
            field_dict["sandbox"] = sandbox

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.error import Error
        from ..models.sandbox import Sandbox

        d = dict(src_dict)
        _error = d.pop("error", UNSET)
        error: Union[Unset, Error]
        if isinstance(_error, Unset):
            error = UNSET
        else:
            error = Error.from_dict(_error)

        _sandbox = d.pop("sandbox", UNSET)
        sandbox: Union[Unset, Sandbox]
        if isinstance(_sandbox, Unset):
            sandbox = UNSET
        else:
            sandbox = Sandbox.from_dict(_sandbox)

        sandbox_fork_result = cls(
            error=error,
            sandbox=sandbox,
        )

        sandbox_fork_result.additional_properties = d
        return sandbox_fork_result

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
