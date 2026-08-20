import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

if TYPE_CHECKING:
    from ..models.secret_metadata import SecretMetadata


T = TypeVar("T", bound="Secret")


@_attrs_define
class Secret:
    """Metadata of a secret. It never carries the secret value.

    Attributes:
        secret_id (str): Identifier of the secret
        name (str): Name of the secret, unique within the project
        current_version (int): Version served to readers that do not name one
        metadata (SecretMetadata): Customer metadata of the secret. Always present, empty when unset. At most 32
            entries; keys are limited to 128 bytes, values to 1024 bytes, and a secret's metadata to 8192 bytes in total.
        created_at (datetime.datetime): Time when the secret was created
        updated_at (datetime.datetime): Time when the secret was last updated
    """

    secret_id: str
    name: str
    current_version: int
    metadata: "SecretMetadata"
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        secret_id = self.secret_id

        name = self.name

        current_version = self.current_version

        metadata = self.metadata.to_dict()

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "secretID": secret_id,
                "name": name,
                "currentVersion": current_version,
                "metadata": metadata,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.secret_metadata import SecretMetadata

        d = dict(src_dict)
        secret_id = d.pop("secretID")

        name = d.pop("name")

        current_version = d.pop("currentVersion")

        metadata = SecretMetadata.from_dict(d.pop("metadata"))

        created_at = isoparse(d.pop("createdAt"))

        updated_at = isoparse(d.pop("updatedAt"))

        secret = cls(
            secret_id=secret_id,
            name=name,
            current_version=current_version,
            metadata=metadata,
            created_at=created_at,
            updated_at=updated_at,
        )

        secret.additional_properties = d
        return secret

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
