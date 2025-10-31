import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.template_build_status import TemplateBuildStatus

if TYPE_CHECKING:
    from ..models.team_user import TeamUser


T = TypeVar("T", bound="Template")


@_attrs_define
class Template:
    """
    Attributes:
        aliases (list[str]): Aliases of the template
        build_count (int): Number of times the template was built
        build_id (str): Identifier of the last successful build for given template
        build_status (TemplateBuildStatus): Status of the template build
        cpu_count (int): CPU cores for the sandbox
        created_at (datetime.datetime): Time when the template was created
        created_by (Union['TeamUser', None]):
        disk_size_mb (int): Disk size for the sandbox in MiB
        envd_version (str): Version of the envd running in the sandbox
        last_spawned_at (Union[None, datetime.datetime]): Time when the template was last used
        memory_mb (int): Memory for the sandbox in MiB
        public (bool): Whether the template is public or only accessible by the team
        spawn_count (int): Number of times the template was used
        template_id (str): Identifier of the template
        updated_at (datetime.datetime): Time when the template was last updated
    """

    aliases: list[str]
    build_count: int
    build_id: str
    build_status: TemplateBuildStatus
    cpu_count: int
    created_at: datetime.datetime
    created_by: Union["TeamUser", None]
    disk_size_mb: int
    envd_version: str
    last_spawned_at: Union[None, datetime.datetime]
    memory_mb: int
    public: bool
    spawn_count: int
    template_id: str
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.team_user import TeamUser

        aliases = self.aliases

        build_count = self.build_count

        build_id = self.build_id

        build_status = self.build_status.value

        cpu_count = self.cpu_count

        created_at = self.created_at.isoformat()

        created_by: Union[None, dict[str, Any]]
        if isinstance(self.created_by, TeamUser):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        disk_size_mb = self.disk_size_mb

        envd_version = self.envd_version

        last_spawned_at: Union[None, str]
        if isinstance(self.last_spawned_at, datetime.datetime):
            last_spawned_at = self.last_spawned_at.isoformat()
        else:
            last_spawned_at = self.last_spawned_at

        memory_mb = self.memory_mb

        public = self.public

        spawn_count = self.spawn_count

        template_id = self.template_id

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aliases": aliases,
                "buildCount": build_count,
                "buildID": build_id,
                "buildStatus": build_status,
                "cpuCount": cpu_count,
                "createdAt": created_at,
                "createdBy": created_by,
                "diskSizeMB": disk_size_mb,
                "envdVersion": envd_version,
                "lastSpawnedAt": last_spawned_at,
                "memoryMB": memory_mb,
                "public": public,
                "spawnCount": spawn_count,
                "templateID": template_id,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.team_user import TeamUser

        d = dict(src_dict)
        aliases = cast(list[str], d.pop("aliases"))

        build_count = d.pop("buildCount")

        build_id = d.pop("buildID")

        build_status = TemplateBuildStatus(d.pop("buildStatus"))

        cpu_count = d.pop("cpuCount")

        created_at = isoparse(d.pop("createdAt"))

        def _parse_created_by(data: object) -> Union["TeamUser", None]:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                created_by_type_1 = TeamUser.from_dict(data)

                return created_by_type_1
            except:  # noqa: E722
                pass
            return cast(Union["TeamUser", None], data)

        created_by = _parse_created_by(d.pop("createdBy"))

        disk_size_mb = d.pop("diskSizeMB")

        envd_version = d.pop("envdVersion")

        def _parse_last_spawned_at(data: object) -> Union[None, datetime.datetime]:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_spawned_at_type_0 = isoparse(data)

                return last_spawned_at_type_0
            except:  # noqa: E722
                pass
            return cast(Union[None, datetime.datetime], data)

        last_spawned_at = _parse_last_spawned_at(d.pop("lastSpawnedAt"))

        memory_mb = d.pop("memoryMB")

        public = d.pop("public")

        spawn_count = d.pop("spawnCount")

        template_id = d.pop("templateID")

        updated_at = isoparse(d.pop("updatedAt"))

        template = cls(
            aliases=aliases,
            build_count=build_count,
            build_id=build_id,
            build_status=build_status,
            cpu_count=cpu_count,
            created_at=created_at,
            created_by=created_by,
            disk_size_mb=disk_size_mb,
            envd_version=envd_version,
            last_spawned_at=last_spawned_at,
            memory_mb=memory_mb,
            public=public,
            spawn_count=spawn_count,
            template_id=template_id,
            updated_at=updated_at,
        )

        template.additional_properties = d
        return template

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
