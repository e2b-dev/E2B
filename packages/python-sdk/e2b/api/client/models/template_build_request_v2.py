from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="TemplateBuildRequestV2")


@_attrs_define
class TemplateBuildRequestV2:
    """
    Attributes:
        alias (str): Alias of the template
        cpu_count (Union[Unset, int]): CPU cores for the sandbox
        memory_mb (Union[Unset, int]): Memory for the sandbox in MiB
        team_id (Union[Unset, str]): Identifier of the team
    """

    alias: str
    cpu_count: Union[Unset, int] = UNSET
    memory_mb: Union[Unset, int] = UNSET
    team_id: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        alias = self.alias

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        team_id = self.team_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "alias": alias,
            }
        )
        if cpu_count is not UNSET:
            field_dict["cpuCount"] = cpu_count
        if memory_mb is not UNSET:
            field_dict["memoryMB"] = memory_mb
        if team_id is not UNSET:
            field_dict["teamID"] = team_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        alias = d.pop("alias")

        cpu_count = d.pop("cpuCount", UNSET)

        memory_mb = d.pop("memoryMB", UNSET)

        team_id = d.pop("teamID", UNSET)

        template_build_request_v2 = cls(
            alias=alias,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            team_id=team_id,
        )

        template_build_request_v2.additional_properties = d
        return template_build_request_v2

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
