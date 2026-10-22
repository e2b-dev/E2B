import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="TemplateTagAssignment")


@_attrs_define
class TemplateTagAssignment:
    """
    Attributes:
        assignment_id (UUID): Identifier of the tag assignment event.
        build_id (UUID): Identifier of the assigned build.
        assigned_at (datetime.datetime): Time when the tag was assigned to the build.
        build_created_at (datetime.datetime): Time when the assigned build was created.
        build_finished_at (Union[None, datetime.datetime]): Time when the assigned build finished.
    """

    assignment_id: UUID
    build_id: UUID
    assigned_at: datetime.datetime
    build_created_at: datetime.datetime
    build_finished_at: Union[None, datetime.datetime]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        assignment_id = str(self.assignment_id)

        build_id = str(self.build_id)

        assigned_at = self.assigned_at.isoformat()

        build_created_at = self.build_created_at.isoformat()

        build_finished_at: Union[None, str]
        if isinstance(self.build_finished_at, datetime.datetime):
            build_finished_at = self.build_finished_at.isoformat()
        else:
            build_finished_at = self.build_finished_at

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "assignmentId": assignment_id,
                "buildId": build_id,
                "assignedAt": assigned_at,
                "buildCreatedAt": build_created_at,
                "buildFinishedAt": build_finished_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        assignment_id = UUID(d.pop("assignmentId"))

        build_id = UUID(d.pop("buildId"))

        assigned_at = isoparse(d.pop("assignedAt"))

        build_created_at = isoparse(d.pop("buildCreatedAt"))

        def _parse_build_finished_at(data: object) -> Union[None, datetime.datetime]:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                build_finished_at_type_0 = isoparse(data)

                return build_finished_at_type_0
            except:  # noqa: E722
                pass
            return cast(Union[None, datetime.datetime], data)

        build_finished_at = _parse_build_finished_at(d.pop("buildFinishedAt"))

        template_tag_assignment = cls(
            assignment_id=assignment_id,
            build_id=build_id,
            assigned_at=assigned_at,
            build_created_at=build_created_at,
            build_finished_at=build_finished_at,
        )

        template_tag_assignment.additional_properties = d
        return template_tag_assignment

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
