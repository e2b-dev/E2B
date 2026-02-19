from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

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
        domain (Union[None, Unset, str]): Base domain where the sandbox traffic is accessible
        envd_access_token (Union[Unset, str]): Access token used for envd communication
        traffic_access_token (Union[None, Unset, str]): Token required for accessing sandbox via proxy.
    """

    client_id: str
    envd_version: str
    sandbox_id: str
    template_id: str
    alias: Union[Unset, str] = UNSET
    domain: Union[None, Unset, str] = UNSET
    envd_access_token: Union[Unset, str] = UNSET
    traffic_access_token: Union[None, Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        envd_version = self.envd_version

        sandbox_id = self.sandbox_id

        template_id = self.template_id

        alias = self.alias

        domain: Union[None, Unset, str]
        if isinstance(self.domain, Unset):
            domain = UNSET
        else:
            domain = self.domain

        envd_access_token = self.envd_access_token

        traffic_access_token: Union[None, Unset, str]
        if isinstance(self.traffic_access_token, Unset):
            traffic_access_token = UNSET
        else:
            traffic_access_token = self.traffic_access_token

        field_dict: dict[str, Any] = {}
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
        if domain is not UNSET:
            field_dict["domain"] = domain
        if envd_access_token is not UNSET:
            field_dict["envdAccessToken"] = envd_access_token
        if traffic_access_token is not UNSET:
            field_dict["trafficAccessToken"] = traffic_access_token

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        client_id = d.pop("clientID")

        envd_version = d.pop("envdVersion")

        sandbox_id = d.pop("sandboxID")

        template_id = d.pop("templateID")

        alias = d.pop("alias", UNSET)

        def _parse_domain(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        domain = _parse_domain(d.pop("domain", UNSET))

        envd_access_token = d.pop("envdAccessToken", UNSET)

        def _parse_traffic_access_token(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        traffic_access_token = _parse_traffic_access_token(
            d.pop("trafficAccessToken", UNSET)
        )

        sandbox = cls(
            client_id=client_id,
            envd_version=envd_version,
            sandbox_id=sandbox_id,
            template_id=template_id,
            alias=alias,
            domain=domain,
            envd_access_token=envd_access_token,
            traffic_access_token=traffic_access_token,
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
