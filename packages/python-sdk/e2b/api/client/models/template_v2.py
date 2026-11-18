import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.template_build_status import TemplateBuildStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.team_user import TeamUser
    from ..models.template_build import TemplateBuild


T = TypeVar("T", bound="TemplateV2")


@_attrs_define
class TemplateV2:
    """A template with its default build. `defaultBuild` is the build a sandbox created without a tag starts from, the
    latest ready build tagged default; it is absent until such a build is ready. `buildStatus` is the status of the
    latest build tagged default in any state: it is `building` while a rebuild runs, although sandboxes still start from
    the default build.

        Attributes:
            template_id (str): Identifier of the template
            names (list[str]): Names of the template (namespace/alias format when namespaced)
            public (bool): Whether the template is public or only accessible by the team
            created_at (datetime.datetime): Time when the template was created
            updated_at (datetime.datetime): Time when the template was last updated
            created_by (Union['TeamUser', None]):
            last_spawned_at (Union[None, datetime.datetime]): Time when the template was last used
            spawn_count (int): Number of times the template was used
            build_count (int): Number of times the template was built
            is_default (bool): Whether the template is one of the platform's default templates
            build_status (TemplateBuildStatus): Status of the template build
            description (Union[Unset, str]): Description of the template
            default_build (Union[Unset, TemplateBuild]):
    """

    template_id: str
    names: list[str]
    public: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    created_by: Union["TeamUser", None]
    last_spawned_at: Union[None, datetime.datetime]
    spawn_count: int
    build_count: int
    is_default: bool
    build_status: TemplateBuildStatus
    description: Union[Unset, str] = UNSET
    default_build: Union[Unset, "TemplateBuild"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.team_user import TeamUser

        template_id = self.template_id

        names = self.names

        public = self.public

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

        is_default = self.is_default

        build_status = self.build_status.value

        description = self.description

        default_build: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.default_build, Unset):
            default_build = self.default_build.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "names": names,
                "public": public,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "createdBy": created_by,
                "lastSpawnedAt": last_spawned_at,
                "spawnCount": spawn_count,
                "buildCount": build_count,
                "isDefault": is_default,
                "buildStatus": build_status,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if default_build is not UNSET:
            field_dict["defaultBuild"] = default_build

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.team_user import TeamUser
        from ..models.template_build import TemplateBuild

        d = dict(src_dict)
        template_id = d.pop("templateID")

        names = cast(list[str], d.pop("names"))

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

        is_default = d.pop("isDefault")

        build_status = TemplateBuildStatus(d.pop("buildStatus"))

        description = d.pop("description", UNSET)

        _default_build = d.pop("defaultBuild", UNSET)
        default_build: Union[Unset, TemplateBuild]
        if isinstance(_default_build, Unset):
            default_build = UNSET
        else:
            default_build = TemplateBuild.from_dict(_default_build)

        template_v2 = cls(
            template_id=template_id,
            names=names,
            public=public,
            created_at=created_at,
            updated_at=updated_at,
            created_by=created_by,
            last_spawned_at=last_spawned_at,
            spawn_count=spawn_count,
            build_count=build_count,
            is_default=is_default,
            build_status=build_status,
            description=description,
            default_build=default_build,
        )

        template_v2.additional_properties = d
        return template_v2

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
