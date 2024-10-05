from typing import Any, Dict, List, Type, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="Template")


@_attrs_define
class Template:
    """
    Attributes:
        template_id (str): Identifier of the template
        build_id (str): Identifier of the last successful build for given template
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MB
        public (bool): Whether the template is public or only accessible by the team
        aliases (Union[Unset, List[str]]): Aliases of the template
    """

    template_id: str
    build_id: str
    cpu_count: int
    memory_mb: int
    public: bool
    aliases: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        template_id = self.template_id

        build_id = self.build_id

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        public = self.public

        aliases: Union[Unset, List[str]] = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "buildID": build_id,
                "cpuCount": cpu_count,
                "memoryMB": memory_mb,
                "public": public,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        template_id = d.pop("templateID")

        build_id = d.pop("buildID")

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        public = d.pop("public")

        aliases = cast(List[str], d.pop("aliases", UNSET))

        template = cls(
            template_id=template_id,
            build_id=build_id,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            public=public,
            aliases=aliases,
        )

        template.additional_properties = d
        return template

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
