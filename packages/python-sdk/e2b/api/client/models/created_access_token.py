import datetime
from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

T = TypeVar("T", bound="CreatedAccessToken")


@_attrs_define
class CreatedAccessToken:
    """
    Attributes:
        created_at (datetime.datetime): Timestamp of access token creation
        id (UUID): Identifier of the access token
        name (str): Name of the access token
        token (str): Raw value of the access token
        token_mask (str): Mask of the access token
    """

    created_at: datetime.datetime
    id: UUID
    name: str
    token: str
    token_mask: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        created_at = self.created_at.isoformat()

        id = str(self.id)

        name = self.name

        token = self.token

        token_mask = self.token_mask

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "createdAt": created_at,
                "id": id,
                "name": name,
                "token": token,
                "tokenMask": token_mask,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        created_at = isoparse(d.pop("createdAt"))

        id = UUID(d.pop("id"))

        name = d.pop("name")

        token = d.pop("token")

        token_mask = d.pop("tokenMask")

        created_access_token = cls(
            created_at=created_at,
            id=id,
            name=name,
            token=token,
            token_mask=token_mask,
        )

        created_access_token.additional_properties = d
        return created_access_token

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
