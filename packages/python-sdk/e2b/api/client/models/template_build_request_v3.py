from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="TemplateBuildRequestV3")


@_attrs_define
class TemplateBuildRequestV3:
    """
    Attributes:
        alias (Union[Unset, str]): Alias of the template. Deprecated, use names instead.
        cpu_count (Union[Unset, int]): CPU cores for the sandbox
        memory_mb (Union[Unset, int]): Memory for the sandbox in MiB
        names (Union[Unset, list[str]]): Names of the template
        team_id (Union[Unset, str]): Identifier of the team
    """

    alias: Union[Unset, str] = UNSET
    cpu_count: Union[Unset, int] = UNSET
    memory_mb: Union[Unset, int] = UNSET
    names: Union[Unset, list[str]] = UNSET
    team_id: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        alias = self.alias

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        names: Union[Unset, list[str]] = UNSET
        if not isinstance(self.names, Unset):
            names = self.names

        team_id = self.team_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if alias is not UNSET:
            field_dict["alias"] = alias
        if cpu_count is not UNSET:
            field_dict["cpuCount"] = cpu_count
        if memory_mb is not UNSET:
            field_dict["memoryMB"] = memory_mb
        if names is not UNSET:
            field_dict["names"] = names
        if team_id is not UNSET:
            field_dict["teamID"] = team_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        alias = d.pop("alias", UNSET)

        cpu_count = d.pop("cpuCount", UNSET)

        memory_mb = d.pop("memoryMB", UNSET)

        names = cast(list[str], d.pop("names", UNSET))

        team_id = d.pop("teamID", UNSET)

        template_build_request_v3 = cls(
            alias=alias,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            names=names,
            team_id=team_id,
        )

        template_build_request_v3.additional_properties = d
        return template_build_request_v3

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
