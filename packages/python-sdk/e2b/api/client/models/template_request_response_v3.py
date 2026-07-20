from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="TemplateRequestResponseV3")


@_attrs_define
class TemplateRequestResponseV3:
    """
    Attributes:
        template_id (str): Identifier of the template
        build_id (str): Identifier of the last successful build for given template
        public (bool): Whether the template is public or only accessible by the team
        names (list[str]): Names of the template
        tags (list[str]): Tags assigned to the template build
        aliases (list[str]): Aliases of the template
    """

    template_id: str
    build_id: str
    public: bool
    names: list[str]
    tags: list[str]
    aliases: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        build_id = self.build_id

        public = self.public

        names = self.names

        tags = self.tags

        aliases = self.aliases

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "buildID": build_id,
                "public": public,
                "names": names,
                "tags": tags,
                "aliases": aliases,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        template_id = d.pop("templateID")

        build_id = d.pop("buildID")

        public = d.pop("public")

        names = cast(list[str], d.pop("names"))

        tags = cast(list[str], d.pop("tags"))

        aliases = cast(list[str], d.pop("aliases"))

        template_request_response_v3 = cls(
            template_id=template_id,
            build_id=build_id,
            public=public,
            names=names,
            tags=tags,
            aliases=aliases,
        )

        template_request_response_v3.additional_properties = d
        return template_request_response_v3

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
