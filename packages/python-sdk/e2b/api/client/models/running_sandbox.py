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
        template_id (str): Identifier of the template from which is the sandbox created
        sandbox_id (str): Identifier of the sandbox
        client_id (str): Identifier of the client
        started_at (datetime.datetime): Time when the sandbox was started
        end_at (datetime.datetime): Time when the sandbox will expire
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MB
        alias (Union[Unset, str]): Alias of the template
        metadata (Union[Unset, Any]):
    """

    template_id: str
    sandbox_id: str
    client_id: str
    started_at: datetime.datetime
    end_at: datetime.datetime
    cpu_count: int
    memory_mb: int
    alias: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        template_id = self.template_id

        sandbox_id = self.sandbox_id

        client_id = self.client_id

        started_at = self.started_at.isoformat()

        end_at = self.end_at.isoformat()

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        alias = self.alias

        metadata = self.metadata

        field_dict: Dict[str, Any] = {}
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
        template_id = d.pop("templateID")

        sandbox_id = d.pop("sandboxID")

        client_id = d.pop("clientID")

        started_at = isoparse(d.pop("startedAt"))

        end_at = isoparse(d.pop("endAt"))

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        alias = d.pop("alias", UNSET)

        metadata = d.pop("metadata", UNSET)

        running_sandbox = cls(
            template_id=template_id,
            sandbox_id=sandbox_id,
            client_id=client_id,
            started_at=started_at,
            end_at=end_at,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
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
