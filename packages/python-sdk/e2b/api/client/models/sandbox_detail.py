import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.sandbox_state import SandboxState
from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxDetail")


@_attrs_define
class SandboxDetail:
    """
    Attributes:
        client_id (str): Identifier of the client
        cpu_count (int): CPU cores for the sandbox
        disk_size_mb (int): Disk size for the sandbox in MiB
        end_at (datetime.datetime): Time when the sandbox will expire
        envd_version (str): Version of the envd running in the sandbox
        memory_mb (int): Memory for the sandbox in MiB
        sandbox_id (str): Identifier of the sandbox
        started_at (datetime.datetime): Time when the sandbox was started
        state (SandboxState): State of the sandbox
        template_id (str): Identifier of the template from which is the sandbox created
        alias (Union[Unset, str]): Alias of the template
        domain (Union[None, Unset, str]): Base domain where the sandbox traffic is accessible
        envd_access_token (Union[Unset, str]): Access token used for envd communication
        metadata (Union[Unset, Any]):
    """

    client_id: str
    cpu_count: int
    disk_size_mb: int
    end_at: datetime.datetime
    envd_version: str
    memory_mb: int
    sandbox_id: str
    started_at: datetime.datetime
    state: SandboxState
    template_id: str
    alias: Union[Unset, str] = UNSET
    domain: Union[None, Unset, str] = UNSET
    envd_access_token: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        cpu_count = self.cpu_count

        disk_size_mb = self.disk_size_mb

        end_at = self.end_at.isoformat()

        envd_version = self.envd_version

        memory_mb = self.memory_mb

        sandbox_id = self.sandbox_id

        started_at = self.started_at.isoformat()

        state = self.state.value

        template_id = self.template_id

        alias = self.alias

        domain: Union[None, Unset, str]
        if isinstance(self.domain, Unset):
            domain = UNSET
        else:
            domain = self.domain

        envd_access_token = self.envd_access_token

        metadata = self.metadata

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clientID": client_id,
                "cpuCount": cpu_count,
                "diskSizeMB": disk_size_mb,
                "endAt": end_at,
                "envdVersion": envd_version,
                "memoryMB": memory_mb,
                "sandboxID": sandbox_id,
                "startedAt": started_at,
                "state": state,
                "templateID": template_id,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if domain is not UNSET:
            field_dict["domain"] = domain
        if envd_access_token is not UNSET:
            field_dict["envdAccessToken"] = envd_access_token
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        client_id = d.pop("clientID")

        cpu_count = d.pop("cpuCount")

        disk_size_mb = d.pop("diskSizeMB")

        end_at = isoparse(d.pop("endAt"))

        envd_version = d.pop("envdVersion")

        memory_mb = d.pop("memoryMB")

        sandbox_id = d.pop("sandboxID")

        started_at = isoparse(d.pop("startedAt"))

        state = SandboxState(d.pop("state"))

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

        metadata = d.pop("metadata", UNSET)

        sandbox_detail = cls(
            client_id=client_id,
            cpu_count=cpu_count,
            disk_size_mb=disk_size_mb,
            end_at=end_at,
            envd_version=envd_version,
            memory_mb=memory_mb,
            sandbox_id=sandbox_id,
            started_at=started_at,
            state=state,
            template_id=template_id,
            alias=alias,
            domain=domain,
            envd_access_token=envd_access_token,
            metadata=metadata,
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
