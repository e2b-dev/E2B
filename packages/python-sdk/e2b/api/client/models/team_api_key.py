import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.team_user import TeamUser


T = TypeVar("T", bound="TeamAPIKey")


@_attrs_define
class TeamAPIKey:
    """
    Attributes:
        created_at (datetime.datetime): Timestamp of API key creation
        created_by (Union['TeamUser', None]):
        id (UUID): Identifier of the API key
        key_mask (str): Mask of the API key
        last_used (Union[None, datetime.datetime]): Last time this API key was used
        name (str): Name of the API key
    """

    created_at: datetime.datetime
    created_by: Union["TeamUser", None]
    id: UUID
    key_mask: str
    last_used: Union[None, datetime.datetime]
    name: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.team_user import TeamUser

        created_at = self.created_at.isoformat()

        created_by: Union[None, dict[str, Any]]
        if isinstance(self.created_by, TeamUser):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        id = str(self.id)

        key_mask = self.key_mask

        last_used: Union[None, str]
        if isinstance(self.last_used, datetime.datetime):
            last_used = self.last_used.isoformat()
        else:
            last_used = self.last_used

        name = self.name

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "createdAt": created_at,
                "createdBy": created_by,
                "id": id,
                "keyMask": key_mask,
                "lastUsed": last_used,
                "name": name,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.team_user import TeamUser

        d = dict(src_dict)
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

        id = UUID(d.pop("id"))

        key_mask = d.pop("keyMask")

        def _parse_last_used(data: object) -> Union[None, datetime.datetime]:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_used_type_0 = isoparse(data)

                return last_used_type_0
            except:  # noqa: E722
                pass
            return cast(Union[None, datetime.datetime], data)

        last_used = _parse_last_used(d.pop("lastUsed"))

        name = d.pop("name")

        team_api_key = cls(
            created_at=created_at,
            created_by=created_by,
            id=id,
            key_mask=key_mask,
            last_used=last_used,
            name=name,
        )

        team_api_key.additional_properties = d
        return team_api_key

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
