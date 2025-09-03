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
        aws_access_key_id (str): AWS Access Key ID for ECR authentication
        aws_region (str): AWS Region where the ECR registry is located
        aws_secret_access_key (str): AWS Secret Access Key for ECR authentication
        type_ (AWSRegistryType): Type of registry authentication
    """

    aws_access_key_id: str
    aws_region: str
    aws_secret_access_key: str
    type_: AWSRegistryType
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        aws_access_key_id = self.aws_access_key_id

        aws_region = self.aws_region

        aws_secret_access_key = self.aws_secret_access_key

        type_ = self.type_.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "awsAccessKeyId": aws_access_key_id,
                "awsRegion": aws_region,
                "awsSecretAccessKey": aws_secret_access_key,
                "type": type_,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        aws_access_key_id = d.pop("awsAccessKeyId")

        aws_region = d.pop("awsRegion")

        aws_secret_access_key = d.pop("awsSecretAccessKey")

        type_ = AWSRegistryType(d.pop("type"))

        aws_registry = cls(
            aws_access_key_id=aws_access_key_id,
            aws_region=aws_region,
            aws_secret_access_key=aws_secret_access_key,
            type_=type_,
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
