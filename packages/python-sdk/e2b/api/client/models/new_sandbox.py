from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="NewSandbox")


@_attrs_define
class NewSandbox:
    """
    Attributes:
        template_id (str): Identifier of the required template
        auto_pause (Union[Unset, bool]): Automatically pauses the sandbox after the timeout Default: False.
        env_vars (Union[Unset, Any]):
        metadata (Union[Unset, Any]):
        secure (Union[Unset, bool]): Secure all system communication with sandbox
        timeout (Union[Unset, int]): Time to live for the sandbox in seconds. Default: 15.
    """

    template_id: str
    auto_pause: Union[Unset, bool] = False
    env_vars: Union[Unset, Any] = UNSET
    metadata: Union[Unset, Any] = UNSET
    secure: Union[Unset, bool] = UNSET
    timeout: Union[Unset, int] = 15
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        auto_pause = self.auto_pause

        env_vars = self.env_vars

        metadata = self.metadata

        secure = self.secure

        timeout = self.timeout

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
            }
        )
        if auto_pause is not UNSET:
            field_dict["autoPause"] = auto_pause
        if env_vars is not UNSET:
            field_dict["envVars"] = env_vars
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if secure is not UNSET:
            field_dict["secure"] = secure
        if timeout is not UNSET:
            field_dict["timeout"] = timeout

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        template_id = d.pop("templateID")

        auto_pause = d.pop("autoPause", UNSET)

        env_vars = d.pop("envVars", UNSET)

        metadata = d.pop("metadata", UNSET)

        secure = d.pop("secure", UNSET)

        timeout = d.pop("timeout", UNSET)

        new_sandbox = cls(
            template_id=template_id,
            auto_pause=auto_pause,
            env_vars=env_vars,
            metadata=metadata,
            secure=secure,
            timeout=timeout,
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
