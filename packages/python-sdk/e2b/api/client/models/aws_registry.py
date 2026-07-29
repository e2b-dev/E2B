from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.aws_registry_type import AWSRegistryType

T = TypeVar("T", bound="AWSRegistry")


@_attrs_define
class AWSRegistry:
    """
    Attributes:
        type_ (AWSRegistryType): Type of registry authentication
        aws_access_key_id (str): AWS Access Key ID for ECR authentication
        aws_secret_access_key (str): AWS Secret Access Key for ECR authentication
        aws_region (str): AWS Region where the ECR registry is located
    """

    type_: AWSRegistryType
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        aws_access_key_id = self.aws_access_key_id

        aws_secret_access_key = self.aws_secret_access_key

        aws_region = self.aws_region

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "awsAccessKeyId": aws_access_key_id,
                "awsSecretAccessKey": aws_secret_access_key,
                "awsRegion": aws_region,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = AWSRegistryType(d.pop("type"))

        aws_access_key_id = d.pop("awsAccessKeyId")

        aws_secret_access_key = d.pop("awsSecretAccessKey")

        aws_region = d.pop("awsRegion")

        aws_registry = cls(
            type_=type_,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            aws_region=aws_region,
        )

        aws_registry.additional_properties = d
        return aws_registry

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
