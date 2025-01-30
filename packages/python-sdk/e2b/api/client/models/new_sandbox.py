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
        env_vars (Union[Unset, Any]):
        metadata (Union[Unset, Any]):
        timeout (Union[Unset, int]): Time to live for the sandbox in seconds. Default: 15.
    """

    template_id: str
    env_vars: Union[Unset, Any] = UNSET
    metadata: Union[Unset, Any] = UNSET
    timeout: Union[Unset, int] = 15
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        env_vars = self.env_vars

        metadata = self.metadata

        timeout = self.timeout

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
            }
        )
        if env_vars is not UNSET:
            field_dict["envVars"] = env_vars
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if timeout is not UNSET:
            field_dict["timeout"] = timeout

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        template_id = d.pop("templateID")

        env_vars = d.pop("envVars", UNSET)

        metadata = d.pop("metadata", UNSET)

        timeout = d.pop("timeout", UNSET)

        new_sandbox = cls(
            template_id=template_id,
            env_vars=env_vars,
            metadata=metadata,
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
