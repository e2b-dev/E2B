from typing import Any, Dict, List, Type, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Sandbox")


@_attrs_define
class Sandbox:
    """
    Attributes:
        client_id (str): Identifier of the client
        envd_version (str): Version of the envd running in the sandbox
        sandbox_id (str): Identifier of the sandbox
        template_id (str): Identifier of the template from which is the sandbox created
        alias (Union[Unset, str]): Alias of the template
    """

    client_id: str
    envd_version: str
    sandbox_id: str
    template_id: str
    alias: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        client_id = self.client_id

        envd_version = self.envd_version

        sandbox_id = self.sandbox_id

        template_id = self.template_id

        alias = self.alias

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clientID": client_id,
                "envdVersion": envd_version,
                "sandboxID": sandbox_id,
                "templateID": template_id,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        client_id = d.pop("clientID")

        envd_version = d.pop("envdVersion")

        sandbox_id = d.pop("sandboxID")

        template_id = d.pop("templateID")

        alias = d.pop("alias", UNSET)

        sandbox = cls(
            client_id=client_id,
            envd_version=envd_version,
            sandbox_id=sandbox_id,
            template_id=template_id,
            alias=alias,
        )

        sandbox.additional_properties = d
        return sandbox

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
