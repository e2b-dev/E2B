from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxEgressProxyConfigType0")


@_attrs_define
class SandboxEgressProxyConfigType0:
    """SOCKS5 proxy for sandbox egress. Outbound TCP is tunneled through the proxy after allow/deny filtering; the sandbox
    is unaware. Domain-matched flows use remote DNS (ATYP=domain).

        Attributes:
            address (str): SOCKS5 proxy address in host:port format (e.g. "proxy.example.com:1080").
            password (Union[Unset, str]): Optional SOCKS5 password (RFC 1929), max 255 bytes.
            username (Union[Unset, str]): Optional SOCKS5 username (RFC 1929), max 255 bytes.
    """

    address: str
    password: Union[Unset, str] = UNSET
    username: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        address = self.address

        password = self.password

        username = self.username

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "address": address,
            }
        )
        if password is not UNSET:
            field_dict["password"] = password
        if username is not UNSET:
            field_dict["username"] = username

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        password = d.pop("password", UNSET)

        username = d.pop("username", UNSET)

        sandbox_egress_proxy_config_type_0 = cls(
            address=address,
            password=password,
            username=username,
        )

        sandbox_egress_proxy_config_type_0.additional_properties = d
        return sandbox_egress_proxy_config_type_0

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
