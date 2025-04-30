import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union

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
        end_at (datetime.datetime): Time when the sandbox will expire
        memory_mb (int): Memory for the sandbox in MB
        sandbox_id (str): Identifier of the sandbox
        started_at (datetime.datetime): Time when the sandbox was started
        state (SandboxState): State of the sandbox
        template_id (str): Identifier of the template from which is the sandbox created
        alias (Union[Unset, str]): Alias of the template
        envd_access_token (Union[Unset, str]): Access token used for envd communication
        envd_version (Union[Unset, str]): Version of the envd running in the sandbox
        metadata (Union[Unset, Any]):
    """

    client_id: str
    cpu_count: int
    end_at: datetime.datetime
    memory_mb: int
    sandbox_id: str
    started_at: datetime.datetime
    state: SandboxState
    template_id: str
    alias: Union[Unset, str] = UNSET
    envd_access_token: Union[Unset, str] = UNSET
    envd_version: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        cpu_count = self.cpu_count

        end_at = self.end_at.isoformat()

        memory_mb = self.memory_mb

        sandbox_id = self.sandbox_id

        started_at = self.started_at.isoformat()

        state = self.state.value

        template_id = self.template_id

        alias = self.alias

        envd_access_token = self.envd_access_token

        envd_version = self.envd_version

        metadata = self.metadata

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clientID": client_id,
                "cpuCount": cpu_count,
                "endAt": end_at,
                "memoryMB": memory_mb,
                "sandboxID": sandbox_id,
                "startedAt": started_at,
                "state": state,
                "templateID": template_id,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if envd_access_token is not UNSET:
            field_dict["envdAccessToken"] = envd_access_token
        if envd_version is not UNSET:
            field_dict["envdVersion"] = envd_version
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        client_id = d.pop("clientID")

        cpu_count = d.pop("cpuCount")

        end_at = isoparse(d.pop("endAt"))

        memory_mb = d.pop("memoryMB")

        sandbox_id = d.pop("sandboxID")

        started_at = isoparse(d.pop("startedAt"))

        state = SandboxState(d.pop("state"))

        template_id = d.pop("templateID")

        alias = d.pop("alias", UNSET)

        envd_access_token = d.pop("envdAccessToken", UNSET)

        envd_version = d.pop("envdVersion", UNSET)

        metadata = d.pop("metadata", UNSET)

        sandbox_detail = cls(
            client_id=client_id,
            cpu_count=cpu_count,
            end_at=end_at,
            memory_mb=memory_mb,
            sandbox_id=sandbox_id,
            started_at=started_at,
            state=state,
            template_id=template_id,
            alias=alias,
            envd_access_token=envd_access_token,
            envd_version=envd_version,
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
