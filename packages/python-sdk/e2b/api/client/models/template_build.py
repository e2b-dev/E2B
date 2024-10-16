from typing import Any, Dict, List, Type, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.template_build_status import TemplateBuildStatus

T = TypeVar("T", bound="TemplateBuild")


@_attrs_define
class TemplateBuild:
    """
    Attributes:
        logs (List[str]): Build logs
        template_id (str): Identifier of the template
        build_id (str): Identifier of the build
        status (TemplateBuildStatus): Status of the template
    """

    logs: List[str]
    template_id: str
    build_id: str
    status: TemplateBuildStatus
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        logs = self.logs

        template_id = self.template_id

        build_id = self.build_id

        status = self.status.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "logs": logs,
                "templateID": template_id,
                "buildID": build_id,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        logs = cast(List[str], d.pop("logs"))

        template_id = d.pop("templateID")

        build_id = d.pop("buildID")

        status = TemplateBuildStatus(d.pop("status"))

        template_build = cls(
            logs=logs,
            template_id=template_id,
            build_id=build_id,
            status=status,
        )

        template_build.additional_properties = d
        return template_build

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
