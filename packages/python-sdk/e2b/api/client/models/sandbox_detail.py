import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.sandbox_state import SandboxState
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_lifecycle import SandboxLifecycle
    from ..models.sandbox_network_config import SandboxNetworkConfig
    from ..models.sandbox_volume_mount import SandboxVolumeMount


T = TypeVar("T", bound="SandboxDetail")


@_attrs_define
class SandboxDetail:
    """
    Attributes:
        template_id (str): Identifier of the template from which is the sandbox created
        sandbox_id (str): Identifier of the sandbox
        client_id (str): Identifier of the client
        started_at (datetime.datetime): Time when the sandbox was started
        end_at (datetime.datetime): Time when the sandbox will expire
        envd_version (str): Version of the envd running in the sandbox
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MiB
        disk_size_mb (int): Disk size for the sandbox in MiB
        state (SandboxState): State of the sandbox
        alias (Union[Unset, str]): Alias of the template
        envd_access_token (Union[Unset, str]): Access token used for envd communication
        allow_internet_access (Union[None, Unset, bool]): Whether internet access was explicitly enabled or disabled for
            the sandbox. Null means it was not explicitly set.
        domain (Union[None, Unset, str]): Base domain where the sandbox traffic is accessible
        metadata (Union[Unset, Any]):
        network (Union[Unset, SandboxNetworkConfig]):
        lifecycle (Union[Unset, SandboxLifecycle]): Sandbox lifecycle policy returned by sandbox info.
        volume_mounts (Union[Unset, list['SandboxVolumeMount']]):
    """

    template_id: str
    sandbox_id: str
    client_id: str
    started_at: datetime.datetime
    end_at: datetime.datetime
    envd_version: str
    cpu_count: int
    memory_mb: int
    disk_size_mb: int
    state: SandboxState
    alias: Union[Unset, str] = UNSET
    envd_access_token: Union[Unset, str] = UNSET
    allow_internet_access: Union[None, Unset, bool] = UNSET
    domain: Union[None, Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    network: Union[Unset, "SandboxNetworkConfig"] = UNSET
    lifecycle: Union[Unset, "SandboxLifecycle"] = UNSET
    volume_mounts: Union[Unset, list["SandboxVolumeMount"]] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        sandbox_id = self.sandbox_id

        client_id = self.client_id

        started_at = self.started_at.isoformat()

        end_at = self.end_at.isoformat()

        envd_version = self.envd_version

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        disk_size_mb = self.disk_size_mb

        state = self.state.value

        alias = self.alias

        envd_access_token = self.envd_access_token

        allow_internet_access: Union[None, Unset, bool]
        if isinstance(self.allow_internet_access, Unset):
            allow_internet_access = UNSET
        else:
            allow_internet_access = self.allow_internet_access

        domain: Union[None, Unset, str]
        if isinstance(self.domain, Unset):
            domain = UNSET
        else:
            domain = self.domain

        metadata = self.metadata

        network: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.network, Unset):
            network = self.network.to_dict()

        lifecycle: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.lifecycle, Unset):
            lifecycle = self.lifecycle.to_dict()

        volume_mounts: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.volume_mounts, Unset):
            volume_mounts = []
            for volume_mounts_item_data in self.volume_mounts:
                volume_mounts_item = volume_mounts_item_data.to_dict()
                volume_mounts.append(volume_mounts_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "sandboxID": sandbox_id,
                "clientID": client_id,
                "startedAt": started_at,
                "endAt": end_at,
                "envdVersion": envd_version,
                "cpuCount": cpu_count,
                "memoryMB": memory_mb,
                "diskSizeMB": disk_size_mb,
                "state": state,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if envd_access_token is not UNSET:
            field_dict["envdAccessToken"] = envd_access_token
        if allow_internet_access is not UNSET:
            field_dict["allowInternetAccess"] = allow_internet_access
        if domain is not UNSET:
            field_dict["domain"] = domain
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if network is not UNSET:
            field_dict["network"] = network
        if lifecycle is not UNSET:
            field_dict["lifecycle"] = lifecycle
        if volume_mounts is not UNSET:
            field_dict["volumeMounts"] = volume_mounts

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_lifecycle import SandboxLifecycle
        from ..models.sandbox_network_config import SandboxNetworkConfig
        from ..models.sandbox_volume_mount import SandboxVolumeMount

        d = dict(src_dict)
        template_id = d.pop("templateID")

        sandbox_id = d.pop("sandboxID")

        client_id = d.pop("clientID")

        started_at = isoparse(d.pop("startedAt"))

        end_at = isoparse(d.pop("endAt"))

        envd_version = d.pop("envdVersion")

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        disk_size_mb = d.pop("diskSizeMB")

        state = SandboxState(d.pop("state"))

        alias = d.pop("alias", UNSET)

        envd_access_token = d.pop("envdAccessToken", UNSET)

        def _parse_allow_internet_access(data: object) -> Union[None, Unset, bool]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, bool], data)

        allow_internet_access = _parse_allow_internet_access(
            d.pop("allowInternetAccess", UNSET)
        )

        def _parse_domain(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        domain = _parse_domain(d.pop("domain", UNSET))

        metadata = d.pop("metadata", UNSET)

        _network = d.pop("network", UNSET)
        network: Union[Unset, SandboxNetworkConfig]
        if isinstance(_network, Unset):
            network = UNSET
        else:
            network = SandboxNetworkConfig.from_dict(_network)

        _lifecycle = d.pop("lifecycle", UNSET)
        lifecycle: Union[Unset, SandboxLifecycle]
        if isinstance(_lifecycle, Unset):
            lifecycle = UNSET
        else:
            lifecycle = SandboxLifecycle.from_dict(_lifecycle)

        volume_mounts = []
        _volume_mounts = d.pop("volumeMounts", UNSET)
        for volume_mounts_item_data in _volume_mounts or []:
            volume_mounts_item = SandboxVolumeMount.from_dict(volume_mounts_item_data)

            volume_mounts.append(volume_mounts_item)

        sandbox_detail = cls(
            template_id=template_id,
            sandbox_id=sandbox_id,
            client_id=client_id,
            started_at=started_at,
            end_at=end_at,
            envd_version=envd_version,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            disk_size_mb=disk_size_mb,
            state=state,
            alias=alias,
            envd_access_token=envd_access_token,
            allow_internet_access=allow_internet_access,
            domain=domain,
            metadata=metadata,
            network=network,
            lifecycle=lifecycle,
            volume_mounts=volume_mounts,
        )

        sandbox_detail.additional_properties = d
        return sandbox_detail

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
