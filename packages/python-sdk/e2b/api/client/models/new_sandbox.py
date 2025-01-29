from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Union


T = TypeVar("T", bound="NewSandbox")


@_attrs_define
class NewSandbox:
    """
    Attributes:
        template_id (str): Identifier of the required template
        timeout (Union[Unset, int]): Time to live for the sandbox in seconds. Default: 15.
        auto_pause (Union[Unset, bool]): Automatically pauses the sandbox after the timeout Default: False.
        metadata (Union[Unset, Any]):
        env_vars (Union[Unset, Any]):
    """

    template_id: str
    timeout: Union[Unset, int] = 15
    auto_pause: Union[Unset, bool] = False
    metadata: Union[Unset, Any] = UNSET
    env_vars: Union[Unset, Any] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        timeout = self.timeout

        auto_pause = self.auto_pause

        metadata = self.metadata

        env_vars = self.env_vars

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
            }
        )
        if timeout is not UNSET:
            field_dict["timeout"] = timeout
        if auto_pause is not UNSET:
            field_dict["autoPause"] = auto_pause
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if env_vars is not UNSET:
            field_dict["envVars"] = env_vars

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        template_id = d.pop("templateID")

        timeout = d.pop("timeout", UNSET)

        auto_pause = d.pop("autoPause", UNSET)

        metadata = d.pop("metadata", UNSET)

        env_vars = d.pop("envVars", UNSET)

        new_sandbox = cls(
            template_id=template_id,
            timeout=timeout,
            auto_pause=auto_pause,
            metadata=metadata,
            env_vars=env_vars,
        )

        new_sandbox.additional_properties = d
        return new_sandbox

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
