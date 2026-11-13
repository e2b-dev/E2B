from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.secret_metadata import SecretMetadata


T = TypeVar("T", bound="NewSecret")


@_attrs_define
class NewSecret:
    """
    Attributes:
        name (str): Name of the secret, unique within the project. Names are lower-cased before storage and returned in
            that canonical form; the sec_ prefix is reserved for secret identifiers.
        value (str): Runtime marker stored as the secret's first version. The runtime resolves it to a value at sandbox
            egress.
        metadata (Union[Unset, SecretMetadata]): Customer metadata of the secret. Always present, empty when unset. At
            most 32 entries; keys are limited to 128 bytes, values to 1024 bytes, and a secret's metadata to 8192 bytes in
            total.
    """

    name: str
    value: str
    metadata: Union[Unset, "SecretMetadata"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        value = self.value

        metadata: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.metadata, Unset):
            metadata = self.metadata.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "value": value,
            }
        )
        if metadata is not UNSET:
            field_dict["metadata"] = metadata

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.secret_metadata import SecretMetadata

        d = dict(src_dict)
        name = d.pop("name")

        value = d.pop("value")

        _metadata = d.pop("metadata", UNSET)
        metadata: Union[Unset, SecretMetadata]
        if isinstance(_metadata, Unset):
            metadata = UNSET
        else:
            metadata = SecretMetadata.from_dict(_metadata)

        new_secret = cls(
            name=name,
            value=value,
            metadata=metadata,
        )

        new_secret.additional_properties = d
        return new_secret

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
