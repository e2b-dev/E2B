import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.team_user import TeamUser


T = TypeVar("T", bound="Template")


@_attrs_define
class Template:
    """
    Attributes:
        build_count (int): Number of times the template was built
        build_id (str): Identifier of the last successful build for given template
        cpu_count (int): CPU cores for the sandbox
        created_at (datetime.datetime): Time when the template was created
        created_by (Union['TeamUser', None]):
        last_spawned_at (datetime.datetime): Time when the template was last used
        memory_mb (int): Memory for the sandbox in MB
        public (bool): Whether the template is public or only accessible by the team
        spawn_count (int): Number of times the template was used
        template_id (str): Identifier of the template
        updated_at (datetime.datetime): Time when the template was last updated
        aliases (Union[Unset, list[str]]): Aliases of the template
    """

    build_count: int
    build_id: str
    cpu_count: int
    created_at: datetime.datetime
    created_by: Union["TeamUser", None]
    last_spawned_at: datetime.datetime
    memory_mb: int
    public: bool
    spawn_count: int
    template_id: str
    updated_at: datetime.datetime
    aliases: Union[Unset, list[str]] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.team_user import TeamUser

        build_count = self.build_count

        build_id = self.build_id

        cpu_count = self.cpu_count

        created_at = self.created_at.isoformat()

        created_by: Union[None, dict[str, Any]]
        if isinstance(self.created_by, TeamUser):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        last_spawned_at = self.last_spawned_at.isoformat()

        memory_mb = self.memory_mb

        public = self.public

        spawn_count = self.spawn_count

        template_id = self.template_id

        updated_at = self.updated_at.isoformat()

        aliases: Union[Unset, list[str]] = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "buildCount": build_count,
                "buildID": build_id,
                "cpuCount": cpu_count,
                "createdAt": created_at,
                "createdBy": created_by,
                "lastSpawnedAt": last_spawned_at,
                "memoryMB": memory_mb,
                "public": public,
                "spawnCount": spawn_count,
                "templateID": template_id,
                "updatedAt": updated_at,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.team_user import TeamUser

        d = dict(src_dict)
        build_count = d.pop("buildCount")

        build_id = d.pop("buildID")

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

        last_spawned_at = isoparse(d.pop("lastSpawnedAt"))

        memory_mb = d.pop("memoryMB")

        public = d.pop("public")

        spawn_count = d.pop("spawnCount")

        template_id = d.pop("templateID")

        updated_at = isoparse(d.pop("updatedAt"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        template = cls(
            build_count=build_count,
            build_id=build_id,
            cpu_count=cpu_count,
            created_at=created_at,
            created_by=created_by,
            last_spawned_at=last_spawned_at,
            memory_mb=memory_mb,
            public=public,
            spawn_count=spawn_count,
            template_id=template_id,
            updated_at=updated_at,
            aliases=aliases,
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
