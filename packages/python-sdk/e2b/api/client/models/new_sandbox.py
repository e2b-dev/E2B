from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.mcp_type_0 import McpType0
    from ..models.sandbox_network_config import SandboxNetworkConfig


T = TypeVar("T", bound="NewSandbox")


@_attrs_define
class NewSandbox:
    """
    Attributes:
        template_id (str): Identifier of the required template
        allow_internet_access (Union[Unset, bool]): Allow sandbox to access the internet. When set to false, it behaves
            the same as specifying denyOut to 0.0.0.0/0 in the network config.
        auto_pause (Union[Unset, bool]): Automatically pauses the sandbox after the timeout Default: False.
        env_vars (Union[Unset, Any]):
        mcp (Union['McpType0', None, Unset]): MCP configuration for the sandbox
        metadata (Union[Unset, Any]):
        network (Union[Unset, SandboxNetworkConfig]):
        secure (Union[Unset, bool]): Secure all system communication with sandbox
        timeout (Union[Unset, int]): Time to live for the sandbox in seconds. Default: 15.
    """

    template_id: str
    allow_internet_access: Union[Unset, bool] = UNSET
    auto_pause: Union[Unset, bool] = False
    env_vars: Union[Unset, Any] = UNSET
    mcp: Union["McpType0", None, Unset] = UNSET
    metadata: Union[Unset, Any] = UNSET
    network: Union[Unset, "SandboxNetworkConfig"] = UNSET
    secure: Union[Unset, bool] = UNSET
    timeout: Union[Unset, int] = 15
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.mcp_type_0 import McpType0

        template_id = self.template_id

        allow_internet_access = self.allow_internet_access

        auto_pause = self.auto_pause

        env_vars = self.env_vars

        mcp: Union[None, Unset, dict[str, Any]]
        if isinstance(self.mcp, Unset):
            mcp = UNSET
        elif isinstance(self.mcp, McpType0):
            mcp = self.mcp.to_dict()
        else:
            mcp = self.mcp

        metadata = self.metadata

        network: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.network, Unset):
            network = self.network.to_dict()

        secure = self.secure

        timeout = self.timeout

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
            }
        )
        if allow_internet_access is not UNSET:
            field_dict["allow_internet_access"] = allow_internet_access
        if auto_pause is not UNSET:
            field_dict["autoPause"] = auto_pause
        if env_vars is not UNSET:
            field_dict["envVars"] = env_vars
        if mcp is not UNSET:
            field_dict["mcp"] = mcp
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if network is not UNSET:
            field_dict["network"] = network
        if secure is not UNSET:
            field_dict["secure"] = secure
        if timeout is not UNSET:
            field_dict["timeout"] = timeout

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.mcp_type_0 import McpType0
        from ..models.sandbox_network_config import SandboxNetworkConfig

        d = dict(src_dict)
        template_id = d.pop("templateID")

        allow_internet_access = d.pop("allow_internet_access", UNSET)

        auto_pause = d.pop("autoPause", UNSET)

        env_vars = d.pop("envVars", UNSET)

        def _parse_mcp(data: object) -> Union["McpType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_mcp_type_0 = McpType0.from_dict(data)

                return componentsschemas_mcp_type_0
            except:  # noqa: E722
                pass
            return cast(Union["McpType0", None, Unset], data)

        mcp = _parse_mcp(d.pop("mcp", UNSET))

        metadata = d.pop("metadata", UNSET)

        _network = d.pop("network", UNSET)
        network: Union[Unset, SandboxNetworkConfig]
        if isinstance(_network, Unset):
            network = UNSET
        else:
            network = SandboxNetworkConfig.from_dict(_network)

        secure = d.pop("secure", UNSET)

        timeout = d.pop("timeout", UNSET)

        new_sandbox = cls(
            template_id=template_id,
            allow_internet_access=allow_internet_access,
            auto_pause=auto_pause,
            env_vars=env_vars,
            mcp=mcp,
            metadata=metadata,
            network=network,
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
