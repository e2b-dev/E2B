import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.sandbox_state import SandboxState
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_volume_mount import SandboxVolumeMount


T = TypeVar("T", bound="ListedSandbox")


@_attrs_define
class ListedSandbox:
    """
    Attributes:
        template_id (str): Identifier of the template from which is the sandbox created
        sandbox_id (str): Identifier of the sandbox
        client_id (str): Identifier of the client
        started_at (datetime.datetime): Time when the sandbox was started
        end_at (datetime.datetime): Time when the sandbox will expire
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MiB
        disk_size_mb (int): Disk size for the sandbox in MiB
        state (SandboxState): State of the sandbox
        envd_version (str): Version of the envd running in the sandbox
        alias (Union[Unset, str]): Alias of the template
        metadata (Union[Unset, Any]):
        volume_mounts (Union[Unset, list['SandboxVolumeMount']]):
    """

    template_id: str
    sandbox_id: str
    client_id: str
    started_at: datetime.datetime
    end_at: datetime.datetime
    cpu_count: int
    memory_mb: int
    disk_size_mb: int
    state: SandboxState
    envd_version: str
    alias: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    volume_mounts: Union[Unset, list["SandboxVolumeMount"]] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        sandbox_id = self.sandbox_id

        client_id = self.client_id

        started_at = self.started_at.isoformat()

        end_at = self.end_at.isoformat()

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        disk_size_mb = self.disk_size_mb

        state = self.state.value

        envd_version = self.envd_version

        alias = self.alias

        metadata = self.metadata

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
                "cpuCount": cpu_count,
                "memoryMB": memory_mb,
                "diskSizeMB": disk_size_mb,
                "state": state,
                "envdVersion": envd_version,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if metadata is not UNSET:
            field_dict["metadata"] = metadata
        if volume_mounts is not UNSET:
            field_dict["volumeMounts"] = volume_mounts

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_volume_mount import SandboxVolumeMount

        d = dict(src_dict)
        template_id = d.pop("templateID")

        sandbox_id = d.pop("sandboxID")

        client_id = d.pop("clientID")

        started_at = isoparse(d.pop("startedAt"))

        end_at = isoparse(d.pop("endAt"))

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        disk_size_mb = d.pop("diskSizeMB")

        state = SandboxState(d.pop("state"))

        envd_version = d.pop("envdVersion")

        alias = d.pop("alias", UNSET)

        metadata = d.pop("metadata", UNSET)

        volume_mounts = []
        _volume_mounts = d.pop("volumeMounts", UNSET)
        for volume_mounts_item_data in _volume_mounts or []:
            volume_mounts_item = SandboxVolumeMount.from_dict(volume_mounts_item_data)

            volume_mounts.append(volume_mounts_item)

        listed_sandbox = cls(
            template_id=template_id,
            sandbox_id=sandbox_id,
            client_id=client_id,
            started_at=started_at,
            end_at=end_at,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            disk_size_mb=disk_size_mb,
            state=state,
            envd_version=envd_version,
            alias=alias,
            metadata=metadata,
            volume_mounts=volume_mounts,
        )

        listed_sandbox.additional_properties = d
        return listed_sandbox

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
