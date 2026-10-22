from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.template_tag_group import TemplateTagGroup


T = TypeVar("T", bound="TemplateTagGroupsResponse")


@_attrs_define
class TemplateTagGroupsResponse:
    """
    Attributes:
        tags (list['TemplateTagGroup']):
        next_cursor (Union[None, str]): Cursor to pass as `tagsCursor` for the next page, or `null` if there is no next
            page.
    """

    tags: list["TemplateTagGroup"]
    next_cursor: Union[None, str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tags = []
        for tags_item_data in self.tags:
            tags_item = tags_item_data.to_dict()
            tags.append(tags_item)

        next_cursor: Union[None, str]
        next_cursor = self.next_cursor

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "tags": tags,
                "nextCursor": next_cursor,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_tag_group import TemplateTagGroup

        d = dict(src_dict)
        tags = []
        _tags = d.pop("tags")
        for tags_item_data in _tags:
            tags_item = TemplateTagGroup.from_dict(tags_item_data)

            tags.append(tags_item)

        def _parse_next_cursor(data: object) -> Union[None, str]:
            if data is None:
                return data
            return cast(Union[None, str], data)

        next_cursor = _parse_next_cursor(d.pop("nextCursor"))

        template_tag_groups_response = cls(
            tags=tags,
            next_cursor=next_cursor,
        )

        template_tag_groups_response.additional_properties = d
        return template_tag_groups_response

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
