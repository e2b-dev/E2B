import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_event_event_data_type_0 import SandboxEventEventDataType0


T = TypeVar("T", bound="SandboxEvent")


@_attrs_define
class SandboxEvent:
    """Sandbox event

    Attributes:
        id (UUID): Event unique identifier
        version (str): Event structure version
        type_ (str): Event name
        timestamp (datetime.datetime): Timestamp of the event
        sandbox_id (str): Unique identifier for the sandbox
        sandbox_execution_id (str): Unique identifier for the sandbox execution
        sandbox_template_id (str): Unique identifier for the sandbox template
        sandbox_build_id (str): Unique identifier for the sandbox build
        sandbox_team_id (UUID): Team identifier associated with the sandbox
        event_category (Union[Unset, str]): Category of the event (e.g., 'lifecycle', 'process', etc.)
        event_label (Union[Unset, str]): Label for the specific event type (e.g., 'sandbox_started', 'process_oom',
            etc.)
        event_data (Union['SandboxEventEventDataType0', None, Unset]): Optional JSON data associated with the event
    """

    id: UUID
    version: str
    type_: str
    timestamp: datetime.datetime
    sandbox_id: str
    sandbox_execution_id: str
    sandbox_template_id: str
    sandbox_build_id: str
    sandbox_team_id: UUID
    event_category: Union[Unset, str] = UNSET
    event_label: Union[Unset, str] = UNSET
    event_data: Union["SandboxEventEventDataType0", None, Unset] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.sandbox_event_event_data_type_0 import SandboxEventEventDataType0

        id = str(self.id)

        version = self.version

        type_ = self.type_

        timestamp = self.timestamp.isoformat()

        sandbox_id = self.sandbox_id

        sandbox_execution_id = self.sandbox_execution_id

        sandbox_template_id = self.sandbox_template_id

        sandbox_build_id = self.sandbox_build_id

        sandbox_team_id = str(self.sandbox_team_id)

        event_category = self.event_category

        event_label = self.event_label

        event_data: Union[None, Unset, dict[str, Any]]
        if isinstance(self.event_data, Unset):
            event_data = UNSET
        elif isinstance(self.event_data, SandboxEventEventDataType0):
            event_data = self.event_data.to_dict()
        else:
            event_data = self.event_data

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "version": version,
                "type": type_,
                "timestamp": timestamp,
                "sandboxId": sandbox_id,
                "sandboxExecutionId": sandbox_execution_id,
                "sandboxTemplateId": sandbox_template_id,
                "sandboxBuildId": sandbox_build_id,
                "sandboxTeamId": sandbox_team_id,
            }
        )
        if event_category is not UNSET:
            field_dict["eventCategory"] = event_category
        if event_label is not UNSET:
            field_dict["eventLabel"] = event_label
        if event_data is not UNSET:
            field_dict["eventData"] = event_data

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_event_event_data_type_0 import SandboxEventEventDataType0

        d = dict(src_dict)
        id = UUID(d.pop("id"))

        version = d.pop("version")

        type_ = d.pop("type")

        timestamp = isoparse(d.pop("timestamp"))

        sandbox_id = d.pop("sandboxId")

        sandbox_execution_id = d.pop("sandboxExecutionId")

        sandbox_template_id = d.pop("sandboxTemplateId")

        sandbox_build_id = d.pop("sandboxBuildId")

        sandbox_team_id = UUID(d.pop("sandboxTeamId"))

        event_category = d.pop("eventCategory", UNSET)

        event_label = d.pop("eventLabel", UNSET)

        def _parse_event_data(
            data: object,
        ) -> Union["SandboxEventEventDataType0", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                event_data_type_0 = SandboxEventEventDataType0.from_dict(data)

                return event_data_type_0
            except:  # noqa: E722
                pass
            return cast(Union["SandboxEventEventDataType0", None, Unset], data)

        event_data = _parse_event_data(d.pop("eventData", UNSET))

        sandbox_event = cls(
            id=id,
            version=version,
            type_=type_,
            timestamp=timestamp,
            sandbox_id=sandbox_id,
            sandbox_execution_id=sandbox_execution_id,
            sandbox_template_id=sandbox_template_id,
            sandbox_build_id=sandbox_build_id,
            sandbox_team_id=sandbox_team_id,
            event_category=event_category,
            event_label=event_label,
            event_data=event_data,
        )

        sandbox_event.additional_properties = d
        return sandbox_event

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
