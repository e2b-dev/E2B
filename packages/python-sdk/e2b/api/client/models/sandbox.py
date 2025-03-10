from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Union


T = TypeVar("T", bound="Sandbox")


@_attrs_define
class Sandbox:
    """
    Attributes:
        template_id (str): Identifier of the template from which is the sandbox created
        sandbox_id (str): Identifier of the sandbox
        client_id (str): Identifier of the client
        envd_version (str): Version of the envd running in the sandbox
        alias (Union[Unset, str]): Alias of the template
    """

    template_id: str
    sandbox_id: str
    client_id: str
    envd_version: str
    alias: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        sandbox_id = self.sandbox_id

        client_id = self.client_id

        envd_version = self.envd_version

        alias = self.alias

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "sandboxID": sandbox_id,
                "clientID": client_id,
                "envdVersion": envd_version,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        template_id = d.pop("templateID")

        sandbox_id = d.pop("sandboxID")

        client_id = d.pop("clientID")

        envd_version = d.pop("envdVersion")

        alias = d.pop("alias", UNSET)

        sandbox = cls(
            template_id=template_id,
            sandbox_id=sandbox_id,
            client_id=client_id,
            envd_version=envd_version,
            alias=alias,
        )

        sandbox.additional_properties = d
        return sandbox

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
