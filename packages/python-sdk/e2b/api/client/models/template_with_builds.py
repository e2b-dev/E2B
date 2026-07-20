import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.template_build import TemplateBuild


T = TypeVar("T", bound="TemplateWithBuilds")


@_attrs_define
class TemplateWithBuilds:
    """
    Attributes:
        template_id (str): Identifier of the template
        public (bool): Whether the template is public or only accessible by the team
        aliases (list[str]): Aliases of the template
        names (list[str]): Names of the template (namespace/alias format when namespaced)
        created_at (datetime.datetime): Time when the template was created
        updated_at (datetime.datetime): Time when the template was last updated
        last_spawned_at (Union[None, datetime.datetime]): Time when the template was last used
        spawn_count (int): Number of times the template was used
        builds (list['TemplateBuild']): List of builds for the template
    """

    template_id: str
    public: bool
    aliases: list[str]
    names: list[str]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    last_spawned_at: Union[None, datetime.datetime]
    spawn_count: int
    builds: list["TemplateBuild"]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        public = self.public

        aliases = self.aliases

        names = self.names

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        last_spawned_at: Union[None, str]
        if isinstance(self.last_spawned_at, datetime.datetime):
            last_spawned_at = self.last_spawned_at.isoformat()
        else:
            last_spawned_at = self.last_spawned_at

        spawn_count = self.spawn_count

        builds = []
        for builds_item_data in self.builds:
            builds_item = builds_item_data.to_dict()
            builds.append(builds_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "public": public,
                "aliases": aliases,
                "names": names,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "lastSpawnedAt": last_spawned_at,
                "spawnCount": spawn_count,
                "builds": builds,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_build import TemplateBuild

        d = dict(src_dict)
        template_id = d.pop("templateID")

        public = d.pop("public")

        aliases = cast(list[str], d.pop("aliases"))

        names = cast(list[str], d.pop("names"))

        created_at = isoparse(d.pop("createdAt"))

        updated_at = isoparse(d.pop("updatedAt"))

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

        builds = []
        _builds = d.pop("builds")
        for builds_item_data in _builds:
            builds_item = TemplateBuild.from_dict(builds_item_data)

            builds.append(builds_item)

        template_with_builds = cls(
            template_id=template_id,
            public=public,
            aliases=aliases,
            names=names,
            created_at=created_at,
            updated_at=updated_at,
            last_spawned_at=last_spawned_at,
            spawn_count=spawn_count,
            builds=builds,
        )

        template_with_builds.additional_properties = d
        return template_with_builds

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
