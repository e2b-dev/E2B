import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.identifier_masking_details import IdentifierMaskingDetails
    from ..models.team_user import TeamUser


T = TypeVar("T", bound="CreatedTeamAPIKey")


@_attrs_define
class CreatedTeamAPIKey:
    """
    Attributes:
        created_at (datetime.datetime): Timestamp of API key creation
        id (UUID): Identifier of the API key
        key (str): Raw value of the API key
        mask (IdentifierMaskingDetails):
        name (str): Name of the API key
        created_by (Union['TeamUser', None, Unset]):
        last_used (Union[None, Unset, datetime.datetime]): Last time this API key was used
    """

    created_at: datetime.datetime
    id: UUID
    key: str
    mask: "IdentifierMaskingDetails"
    name: str
    created_by: Union["TeamUser", None, Unset] = UNSET
    last_used: Union[None, Unset, datetime.datetime] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.team_user import TeamUser

        created_at = self.created_at.isoformat()

        id = str(self.id)

        key = self.key

        mask = self.mask.to_dict()

        name = self.name

        created_by: Union[None, Unset, dict[str, Any]]
        if isinstance(self.created_by, Unset):
            created_by = UNSET
        elif isinstance(self.created_by, TeamUser):
            created_by = self.created_by.to_dict()
        else:
            created_by = self.created_by

        last_used: Union[None, Unset, str]
        if isinstance(self.last_used, Unset):
            last_used = UNSET
        elif isinstance(self.last_used, datetime.datetime):
            last_used = self.last_used.isoformat()
        else:
            last_used = self.last_used

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "createdAt": created_at,
                "id": id,
                "key": key,
                "mask": mask,
                "name": name,
            }
        )
        if created_by is not UNSET:
            field_dict["createdBy"] = created_by
        if last_used is not UNSET:
            field_dict["lastUsed"] = last_used

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.identifier_masking_details import IdentifierMaskingDetails
        from ..models.team_user import TeamUser

        d = dict(src_dict)
        created_at = isoparse(d.pop("createdAt"))

        id = UUID(d.pop("id"))

        key = d.pop("key")

        mask = IdentifierMaskingDetails.from_dict(d.pop("mask"))

        name = d.pop("name")

        def _parse_created_by(data: object) -> Union["TeamUser", None, Unset]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                created_by_type_1 = TeamUser.from_dict(data)

                return created_by_type_1
            except:  # noqa: E722
                pass
            return cast(Union["TeamUser", None, Unset], data)

        created_by = _parse_created_by(d.pop("createdBy", UNSET))

        def _parse_last_used(data: object) -> Union[None, Unset, datetime.datetime]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_used_type_0 = isoparse(data)

                return last_used_type_0
            except:  # noqa: E722
                pass
            return cast(Union[None, Unset, datetime.datetime], data)

        last_used = _parse_last_used(d.pop("lastUsed", UNSET))

        created_team_api_key = cls(
            created_at=created_at,
            id=id,
            key=key,
            mask=mask,
            name=name,
            created_by=created_by,
            last_used=last_used,
        )

        created_team_api_key.additional_properties = d
        return created_team_api_key

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
