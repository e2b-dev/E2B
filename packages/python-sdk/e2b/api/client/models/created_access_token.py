import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.identifier_masking_details import IdentifierMaskingDetails


T = TypeVar("T", bound="CreatedAccessToken")


@_attrs_define
class CreatedAccessToken:
    """
    Attributes:
        created_at (datetime.datetime): Timestamp of access token creation
        id (UUID): Identifier of the access token
        mask (IdentifierMaskingDetails):
        name (str): Name of the access token
        token (str): The fully created access token
    """

    created_at: datetime.datetime
    id: UUID
    mask: "IdentifierMaskingDetails"
    name: str
    token: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        created_at = self.created_at.isoformat()

        id = str(self.id)

        mask = self.mask.to_dict()

        name = self.name

        token = self.token

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "createdAt": created_at,
                "id": id,
                "mask": mask,
                "name": name,
                "token": token,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.identifier_masking_details import IdentifierMaskingDetails

        d = dict(src_dict)
        created_at = isoparse(d.pop("createdAt"))

        id = UUID(d.pop("id"))

        mask = IdentifierMaskingDetails.from_dict(d.pop("mask"))

        name = d.pop("name")

        token = d.pop("token")

        created_access_token = cls(
            created_at=created_at,
            id=id,
            mask=mask,
            name=name,
            token=token,
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
