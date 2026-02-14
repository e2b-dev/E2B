from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="TemplateBuildRequest")


@_attrs_define
class TemplateBuildRequest:
    """
    Attributes:
        dockerfile (str): Dockerfile for the template
        alias (str | Unset): Alias of the template
        cpu_count (int | Unset): CPU cores for the sandbox
        memory_mb (int | Unset): Memory for the sandbox in MiB
        ready_cmd (str | Unset): Ready check command to execute in the template after the build
        start_cmd (str | Unset): Start command to execute in the template after the build
        team_id (str | Unset): Identifier of the team
    """

    dockerfile: str
    alias: str | Unset = UNSET
    cpu_count: int | Unset = UNSET
    memory_mb: int | Unset = UNSET
    ready_cmd: str | Unset = UNSET
    start_cmd: str | Unset = UNSET
    team_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        dockerfile = self.dockerfile

        alias = self.alias

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        ready_cmd = self.ready_cmd

        start_cmd = self.start_cmd

        team_id = self.team_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dockerfile": dockerfile,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if cpu_count is not UNSET:
            field_dict["cpuCount"] = cpu_count
        if memory_mb is not UNSET:
            field_dict["memoryMB"] = memory_mb
        if ready_cmd is not UNSET:
            field_dict["readyCmd"] = ready_cmd
        if start_cmd is not UNSET:
            field_dict["startCmd"] = start_cmd
        if team_id is not UNSET:
            field_dict["teamID"] = team_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        dockerfile = d.pop("dockerfile")

        alias = d.pop("alias", UNSET)

        cpu_count = d.pop("cpuCount", UNSET)

        memory_mb = d.pop("memoryMB", UNSET)

        ready_cmd = d.pop("readyCmd", UNSET)

        start_cmd = d.pop("startCmd", UNSET)

        team_id = d.pop("teamID", UNSET)

        template_build_request = cls(
            dockerfile=dockerfile,
            alias=alias,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            ready_cmd=ready_cmd,
            start_cmd=start_cmd,
            team_id=team_id,
        )

        template_build_request.additional_properties = d
        return template_build_request

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
