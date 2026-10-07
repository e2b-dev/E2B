from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_egress_proxy_tls_config_type_0 import (
        SandboxEgressProxyTLSConfigType0,
    )


T = TypeVar("T", bound="SandboxEgressProxyConfigType0")


@_attrs_define
class SandboxEgressProxyConfigType0:
    """SOCKS5 proxy for sandbox egress. Outbound TCP is tunneled through the proxy after allow/deny filtering; the sandbox
    is unaware. Domain-matched flows use remote DNS (ATYP=domain).

        Attributes:
            address (str): SOCKS5 proxy address in host:port format (e.g. "proxy.example.com:1080").
            username (Union[Unset, str]): Optional SOCKS5 username (RFC 1929), max 255 bytes.
            password (Union[Unset, str]): Optional SOCKS5 password (RFC 1929), max 255 bytes.
            tls (Union['SandboxEgressProxyTLSConfigType0', None, Unset]): TLS for the connection to the SOCKS5 proxy. The
                SOCKS5 negotiation and the tunneled traffic both run inside the TLS session, so the proxy credentials are not
                sent in the clear. This secures only the hop to the proxy; what the proxy does onward is its own concern. A
                half-close from the sandbox reaches the proxy as a TLS close_notify, not a TCP FIN, and a proxy that treats
                close_notify as a full close cuts the reply short.
    """

    address: str
    username: Union[Unset, str] = UNSET
    password: Union[Unset, str] = UNSET
    tls: Union["SandboxEgressProxyTLSConfigType0", None, Unset] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.sandbox_egress_proxy_tls_config_type_0 import (
            SandboxEgressProxyTLSConfigType0,
        )

        address = self.address

        username = self.username

        password = self.password

        tls: Union[None, Unset, dict[str, Any]]
        if isinstance(self.tls, Unset):
            tls = UNSET
        elif isinstance(self.tls, SandboxEgressProxyTLSConfigType0):
            tls = self.tls.to_dict()
        else:
            tls = self.tls

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "address": address,
            }
        )
        if username is not UNSET:
            field_dict["username"] = username
        if password is not UNSET:
            field_dict["password"] = password
        if tls is not UNSET:
            field_dict["tls"] = tls

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_egress_proxy_tls_config_type_0 import (
            SandboxEgressProxyTLSConfigType0,
        )

        d = dict(src_dict)
        address = d.pop("address")

        username = d.pop("username", UNSET)

        password = d.pop("password", UNSET)

        def _parse_tls(
            data: object,
        ) -> Union["SandboxEgressProxyTLSConfigType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_sandbox_egress_proxy_tls_config_type_0 = (
                    SandboxEgressProxyTLSConfigType0.from_dict(data)
                )

                return componentsschemas_sandbox_egress_proxy_tls_config_type_0
            except:  # noqa: E722
                pass
            return cast(Union["SandboxEgressProxyTLSConfigType0", None, Unset], data)

        tls = _parse_tls(d.pop("tls", UNSET))

        sandbox_egress_proxy_config_type_0 = cls(
            address=address,
            username=username,
            password=password,
            tls=tls,
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
