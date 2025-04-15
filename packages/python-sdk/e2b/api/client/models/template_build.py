from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.template_build_status import TemplateBuildStatus

T = TypeVar("T", bound="TemplateBuild")


@_attrs_define
class TemplateBuild:
    """
    Attributes:
        build_id (str): Identifier of the build
        logs (list[str]): Build logs
        status (TemplateBuildStatus): Status of the template
        template_id (str): Identifier of the template
    """

    build_id: str
    logs: list[str]
    status: TemplateBuildStatus
    template_id: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        build_id = self.build_id

        logs = self.logs

        status = self.status.value

        template_id = self.template_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "buildID": build_id,
                "logs": logs,
                "status": status,
                "templateID": template_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        build_id = d.pop("buildID")

        logs = cast(list[str], d.pop("logs"))

        status = TemplateBuildStatus(d.pop("status"))

        template_id = d.pop("templateID")

        template_build = cls(
            build_id=build_id,
            logs=logs,
            status=status,
            template_id=template_id,
        )

        template_build.additional_properties = d
        return template_build

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
