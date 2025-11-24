import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.template_build_status import TemplateBuildStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="TemplateBuild")


@_attrs_define
class TemplateBuild:
    """
    Attributes:
        build_id (UUID): Identifier of the build
        cpu_count (int): CPU cores for the sandbox
        created_at (datetime.datetime): Time when the build was created
        memory_mb (int): Memory for the sandbox in MiB
        status (TemplateBuildStatus): Status of the template build
        updated_at (datetime.datetime): Time when the build was last updated
        disk_size_mb (Union[Unset, int]): Disk size for the sandbox in MiB
        envd_version (Union[Unset, str]): Version of the envd running in the sandbox
        finished_at (Union[Unset, datetime.datetime]): Time when the build was finished
    """

    build_id: UUID
    cpu_count: int
    created_at: datetime.datetime
    memory_mb: int
    status: TemplateBuildStatus
    updated_at: datetime.datetime
    disk_size_mb: Union[Unset, int] = UNSET
    envd_version: Union[Unset, str] = UNSET
    finished_at: Union[Unset, datetime.datetime] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        build_id = str(self.build_id)

        cpu_count = self.cpu_count

        created_at = self.created_at.isoformat()

        memory_mb = self.memory_mb

        status = self.status.value

        updated_at = self.updated_at.isoformat()

        disk_size_mb = self.disk_size_mb

        envd_version = self.envd_version

        finished_at: Union[Unset, str] = UNSET
        if not isinstance(self.finished_at, Unset):
            finished_at = self.finished_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "buildID": build_id,
                "cpuCount": cpu_count,
                "createdAt": created_at,
                "memoryMB": memory_mb,
                "status": status,
                "updatedAt": updated_at,
            }
        )
        if disk_size_mb is not UNSET:
            field_dict["diskSizeMB"] = disk_size_mb
        if envd_version is not UNSET:
            field_dict["envdVersion"] = envd_version
        if finished_at is not UNSET:
            field_dict["finishedAt"] = finished_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        build_id = UUID(d.pop("buildID"))

        cpu_count = d.pop("cpuCount")

        created_at = isoparse(d.pop("createdAt"))

        memory_mb = d.pop("memoryMB")

        status = TemplateBuildStatus(d.pop("status"))

        updated_at = isoparse(d.pop("updatedAt"))

        disk_size_mb = d.pop("diskSizeMB", UNSET)

        envd_version = d.pop("envdVersion", UNSET)

        _finished_at = d.pop("finishedAt", UNSET)
        finished_at: Union[Unset, datetime.datetime]
        if isinstance(_finished_at, Unset):
            finished_at = UNSET
        else:
            finished_at = isoparse(_finished_at)

        template_build = cls(
            build_id=build_id,
            cpu_count=cpu_count,
            created_at=created_at,
            memory_mb=memory_mb,
            status=status,
            updated_at=updated_at,
            disk_size_mb=disk_size_mb,
            envd_version=envd_version,
            finished_at=finished_at,
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
