import datetime
from typing import Any, Dict, List, Type, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

T = TypeVar("T", bound="RunningSandbox")


@_attrs_define
class RunningSandbox:
    """
    Attributes:
        client_id (str): Identifier of the client
        cpu_count (int): CPU cores for the sandbox
        end_at (datetime.datetime): Time when the sandbox will expire
        memory_mb (int): Memory for the sandbox in MB
        sandbox_id (str): Identifier of the sandbox
        started_at (datetime.datetime): Time when the sandbox was started
        template_id (str): Identifier of the template from which is the sandbox created
        alias (Union[Unset, str]): Alias of the template
        metadata (Union[Unset, Any]):
    """

    client_id: str
    cpu_count: int
    end_at: datetime.datetime
    memory_mb: int
    sandbox_id: str
    started_at: datetime.datetime
    template_id: str
    alias: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        client_id = self.client_id

        cpu_count = self.cpu_count

        end_at = self.end_at.isoformat()

        memory_mb = self.memory_mb

        sandbox_id = self.sandbox_id

        started_at = self.started_at.isoformat()

        template_id = self.template_id

        alias = self.alias

        metadata = self.metadata

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "clientID": client_id,
                "cpuCount": cpu_count,
                "endAt": end_at,
                "memoryMB": memory_mb,
                "sandboxID": sandbox_id,
                "startedAt": started_at,
                "templateID": template_id,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        client_id = d.pop("clientID")

        cpu_count = d.pop("cpuCount")

        end_at = isoparse(d.pop("endAt"))

        memory_mb = d.pop("memoryMB")

        sandbox_id = d.pop("sandboxID")

        started_at = isoparse(d.pop("startedAt"))

        template_id = d.pop("templateID")

        alias = d.pop("alias", UNSET)

        metadata = d.pop("metadata", UNSET)

        running_sandbox = cls(
            client_id=client_id,
            cpu_count=cpu_count,
            end_at=end_at,
            memory_mb=memory_mb,
            sandbox_id=sandbox_id,
            started_at=started_at,
            template_id=template_id,
            alias=alias,
            metadata=metadata,
        )

        running_sandbox.additional_properties = d
        return running_sandbox

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
