from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="IdentifierMaskingDetails")


@_attrs_define
class IdentifierMaskingDetails:
    """
    Attributes:
        prefix (str): Prefix that identifies the token or key type
        value_length (int): Length of the token or key
        masked_value_prefix (str): Prefix used in masked version of the token or key
        masked_value_suffix (str): Suffix used in masked version of the token or key
    """

    prefix: str
    value_length: int
    masked_value_prefix: str
    masked_value_suffix: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        prefix = self.prefix

        value_length = self.value_length

        masked_value_prefix = self.masked_value_prefix

        masked_value_suffix = self.masked_value_suffix

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "prefix": prefix,
                "valueLength": value_length,
                "maskedValuePrefix": masked_value_prefix,
                "maskedValueSuffix": masked_value_suffix,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        prefix = d.pop("prefix")

        value_length = d.pop("valueLength")

        masked_value_prefix = d.pop("maskedValuePrefix")

        masked_value_suffix = d.pop("maskedValueSuffix")

        identifier_masking_details = cls(
            prefix=prefix,
            value_length=value_length,
            masked_value_prefix=masked_value_prefix,
            masked_value_suffix=masked_value_suffix,
        )

        identifier_masking_details.additional_properties = d
        return identifier_masking_details

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
