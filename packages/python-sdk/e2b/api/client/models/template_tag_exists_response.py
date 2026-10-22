from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="TemplateTagExistsResponse")


@_attrs_define
class TemplateTagExistsResponse:
    """
    Attributes:
        exists (bool): Whether the template tag has at least one ready assignment.
        normalized_tag (str): Normalized template tag name.
    """

    exists: bool
    normalized_tag: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        exists = self.exists

        normalized_tag = self.normalized_tag

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "exists": exists,
                "normalizedTag": normalized_tag,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        exists = d.pop("exists")

        normalized_tag = d.pop("normalizedTag")

        template_tag_exists_response = cls(
            exists=exists,
            normalized_tag=normalized_tag,
        )

        template_tag_exists_response.additional_properties = d
        return template_tag_exists_response

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
