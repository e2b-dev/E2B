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
        aliases (list[str]): Aliases of the template
        builds (list['TemplateBuild']): List of builds for the template
        created_at (datetime.datetime): Time when the template was created
        last_spawned_at (Union[None, datetime.datetime]): Time when the template was last used
        public (bool): Whether the template is public or only accessible by the team
        spawn_count (int): Number of times the template was used
        template_id (str): Identifier of the template
        updated_at (datetime.datetime): Time when the template was last updated
    """

    aliases: list[str]
    builds: list["TemplateBuild"]
    created_at: datetime.datetime
    last_spawned_at: Union[None, datetime.datetime]
    public: bool
    spawn_count: int
    template_id: str
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        aliases = self.aliases

        builds = []
        for builds_item_data in self.builds:
            builds_item = builds_item_data.to_dict()
            builds.append(builds_item)

        created_at = self.created_at.isoformat()

        last_spawned_at: Union[None, str]
        if isinstance(self.last_spawned_at, datetime.datetime):
            last_spawned_at = self.last_spawned_at.isoformat()
        else:
            last_spawned_at = self.last_spawned_at

        public = self.public

        spawn_count = self.spawn_count

        template_id = self.template_id

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aliases": aliases,
                "builds": builds,
                "createdAt": created_at,
                "lastSpawnedAt": last_spawned_at,
                "public": public,
                "spawnCount": spawn_count,
                "templateID": template_id,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_build import TemplateBuild

        d = dict(src_dict)
        aliases = cast(list[str], d.pop("aliases"))

        builds = []
        _builds = d.pop("builds")
        for builds_item_data in _builds:
            builds_item = TemplateBuild.from_dict(builds_item_data)

            builds.append(builds_item)

        created_at = isoparse(d.pop("createdAt"))

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

        public = d.pop("public")

        spawn_count = d.pop("spawnCount")

        template_id = d.pop("templateID")

        updated_at = isoparse(d.pop("updatedAt"))

        template_with_builds = cls(
            aliases=aliases,
            builds=builds,
            created_at=created_at,
            last_spawned_at=last_spawned_at,
            public=public,
            spawn_count=spawn_count,
            template_id=template_id,
            updated_at=updated_at,
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
