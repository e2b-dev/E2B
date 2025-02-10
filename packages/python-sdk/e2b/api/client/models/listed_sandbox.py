import datetime
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.sandbox_state import SandboxState, check_sandbox_state
from ..types import UNSET, Unset

T = TypeVar("T", bound="ListedSandbox")


@_attrs_define
class ListedSandbox:
    """
    Attributes:
        client_id (str): Identifier of the client
        cpu_count (int): CPU cores for the sandbox
        end_at (datetime.datetime): Time when the sandbox will expire
        memory_mb (int): Memory for the sandbox in MB
        sandbox_id (str): Identifier of the sandbox
        started_at (Union[None, datetime.datetime]): Time when the sandbox was started
        state (SandboxState): State of the sandbox
        template_id (str): Identifier of the template from which is the sandbox created
        alias (Union[Unset, str]): Alias of the template
        metadata (Union[Unset, Any]):
    """

    client_id: str
    cpu_count: int
    end_at: datetime.datetime
    memory_mb: int
    sandbox_id: str
    started_at: Union[None, datetime.datetime]
    state: SandboxState
    template_id: str
    alias: Union[Unset, str] = UNSET
    metadata: Union[Unset, Any] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        client_id = self.client_id

        cpu_count = self.cpu_count

        end_at = self.end_at.isoformat()

        memory_mb = self.memory_mb

        sandbox_id = self.sandbox_id

        started_at: Union[None, str]
        if isinstance(self.started_at, datetime.datetime):
            started_at = self.started_at.isoformat()
        else:
            started_at = self.started_at

        state: str = self.state

        template_id = self.template_id

        alias = self.alias

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
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        client_id = d.pop("clientID")

        cpu_count = d.pop("cpuCount")

        end_at = isoparse(d.pop("endAt"))

        memory_mb = d.pop("memoryMB")

        sandbox_id = d.pop("sandboxID")

        def _parse_started_at(data: object) -> Union[None, datetime.datetime]:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                started_at_type_0 = isoparse(data)

                return started_at_type_0
            except:  # noqa: E722
                pass
            return cast(Union[None, datetime.datetime], data)

        started_at = _parse_started_at(d.pop("startedAt"))

        state = check_sandbox_state(d.pop("state"))

        template_id = d.pop("templateID")

        alias = d.pop("alias", UNSET)

        metadata = d.pop("metadata", UNSET)

        listed_sandbox = cls(
            client_id=client_id,
            cpu_count=cpu_count,
            end_at=end_at,
            memory_mb=memory_mb,
            sandbox_id=sandbox_id,
            started_at=started_at,
            state=state,
            template_id=template_id,
            alias=alias,
            metadata=metadata,
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
