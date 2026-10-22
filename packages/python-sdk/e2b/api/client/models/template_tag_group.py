from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.template_tag_assignment import TemplateTagAssignment


T = TypeVar("T", bound="TemplateTagGroup")


@_attrs_define
class TemplateTagGroup:
    """
    Attributes:
        tag (str): Template tag name.
        assignments (list['TemplateTagAssignment']): Ready assignment events for this tag, sorted latest first.
        has_more (bool): Whether more ready assignment events exist beyond the requested assignment limit.
    """

    tag: str
    assignments: list["TemplateTagAssignment"]
    has_more: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tag = self.tag

        assignments = []
        for assignments_item_data in self.assignments:
            assignments_item = assignments_item_data.to_dict()
            assignments.append(assignments_item)

        has_more = self.has_more

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "tag": tag,
                "assignments": assignments,
                "hasMore": has_more,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_tag_assignment import TemplateTagAssignment

        d = dict(src_dict)
        tag = d.pop("tag")

        assignments = []
        _assignments = d.pop("assignments")
        for assignments_item_data in _assignments:
            assignments_item = TemplateTagAssignment.from_dict(assignments_item_data)

            assignments.append(assignments_item)

        has_more = d.pop("hasMore")

        template_tag_group = cls(
            tag=tag,
            assignments=assignments,
            has_more=has_more,
        )

        template_tag_group.additional_properties = d
        return template_tag_group

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
