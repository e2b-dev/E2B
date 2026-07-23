import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.team_user import TeamUser


T = TypeVar("T", bound="TemplateLegacy")


@_attrs_define
class TemplateLegacy:
    """
    Attributes:
        template_id (str): Identifier of the template
        build_id (str): Identifier of the last successful build for given template
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MiB
        disk_size_mb (int): Disk size for the sandbox in MiB
        public (bool): Whether the template is public or only accessible by the team
        aliases (list[str]): Aliases of the template
        created_at (datetime.datetime): Time when the template was created
        updated_at (datetime.datetime): Time when the template was last updated
        created_by (Union['TeamUser', None]):
        last_spawned_at (Union[None, datetime.datetime]): Time when the template was last used
        spawn_count (int): Number of times the template was used
        build_count (int): Number of times the template was built
        envd_version (str): Version of the envd running in the sandbox
    """

    template_id: str
    build_id: str
    cpu_count: int
    memory_mb: int
    disk_size_mb: int
    public: bool
    aliases: list[str]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    created_by: Union["TeamUser", None]
    last_spawned_at: Union[None, datetime.datetime]
    spawn_count: int
    build_count: int
    envd_version: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.team_user import TeamUser

        template_id = self.template_id

        build_id = self.build_id

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        disk_size_mb = self.disk_size_mb

        public = self.public

        aliases = self.aliases

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        created_by: Union[None, dict[str, Any]]
        if isinstance(self.created_by, TeamUser):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        last_spawned_at: Union[None, str]
        if isinstance(self.last_spawned_at, datetime.datetime):
            last_spawned_at = self.last_spawned_at.isoformat()
        else:
            last_spawned_at = self.last_spawned_at

        spawn_count = self.spawn_count

        build_count = self.build_count

        envd_version = self.envd_version

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "buildID": build_id,
                "cpuCount": cpu_count,
                "memoryMB": memory_mb,
                "diskSizeMB": disk_size_mb,
                "public": public,
                "aliases": aliases,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "createdBy": created_by,
                "lastSpawnedAt": last_spawned_at,
                "spawnCount": spawn_count,
                "buildCount": build_count,
                "envdVersion": envd_version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.team_user import TeamUser

        d = dict(src_dict)
        template_id = d.pop("templateID")

        build_id = d.pop("buildID")

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        disk_size_mb = d.pop("diskSizeMB")

        public = d.pop("public")

        aliases = cast(list[str], d.pop("aliases"))

        created_at = isoparse(d.pop("createdAt"))

        updated_at = isoparse(d.pop("updatedAt"))

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

        spawn_count = d.pop("spawnCount")

        build_count = d.pop("buildCount")

        envd_version = d.pop("envdVersion")

        template_legacy = cls(
            template_id=template_id,
            build_id=build_id,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            disk_size_mb=disk_size_mb,
            public=public,
            aliases=aliases,
            created_at=created_at,
            updated_at=updated_at,
            created_by=created_by,
            last_spawned_at=last_spawned_at,
            spawn_count=spawn_count,
            build_count=build_count,
            envd_version=envd_version,
        )

        template_legacy.additional_properties = d
        return template_legacy

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
