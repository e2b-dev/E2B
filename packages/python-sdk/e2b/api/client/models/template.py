import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Type, TypeVar, Union, cast

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
        template_id (str): Identifier of the template
        build_id (str): Identifier of the last successful build for given template
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MB
        public (bool): Whether the template is public or only accessible by the team
        created_at (datetime.datetime): Time when the template was created
        updated_at (datetime.datetime): Time when the template was last updated
        created_by (Union['TeamUser', None]):
        last_spawned_at (datetime.datetime): Time when the template was last used
        spawn_count (int): Number of times the template was used
        build_count (int): Number of times the template was built
        aliases (Union[Unset, List[str]]): Aliases of the template
    """

    template_id: str
    build_id: str
    cpu_count: int
    memory_mb: int
    public: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    created_by: Union["TeamUser", None]
    last_spawned_at: datetime.datetime
    spawn_count: int
    build_count: int
    aliases: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from ..models.team_user import TeamUser

        template_id = self.template_id

        build_id = self.build_id

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        public = self.public

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        created_by: Union[Dict[str, Any], None]
        if isinstance(self.created_by, TeamUser):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        last_spawned_at = self.last_spawned_at.isoformat()

        spawn_count = self.spawn_count

        build_count = self.build_count

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
                "createdAt": created_at,
                "updatedAt": updated_at,
                "createdBy": created_by,
                "lastSpawnedAt": last_spawned_at,
                "spawnCount": spawn_count,
                "buildCount": build_count,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        from ..models.team_user import TeamUser

        d = src_dict.copy()
        template_id = d.pop("templateID")

        build_id = d.pop("buildID")

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        public = d.pop("public")

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

        last_spawned_at = isoparse(d.pop("lastSpawnedAt"))

        spawn_count = d.pop("spawnCount")

        build_count = d.pop("buildCount")

        aliases = cast(List[str], d.pop("aliases", UNSET))

        template = cls(
            template_id=template_id,
            build_id=build_id,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            public=public,
            created_at=created_at,
            updated_at=updated_at,
            created_by=created_by,
            last_spawned_at=last_spawned_at,
            spawn_count=spawn_count,
            build_count=build_count,
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
