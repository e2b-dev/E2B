import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

T = TypeVar("T", bound="RigInstance")


@_attrs_define
class RigInstance:
    """An instance attached to a rig's scaling group

    Attributes:
        id (str): Provider instance ID (EC2 instance ID on AWS, instance name on GCP), also the node ID the orchestrator
            reports
        transitioning (bool): The provider is creating, deleting, recreating or otherwise mutating the instance
        terminating (bool): The instance is on its way out of the group and can never become healthy again
        created_at (Union[Unset, datetime.datetime]): When the provider created the instance. Omitted while the instance
            is transitioning.
    """

    id: str
    transitioning: bool
    terminating: bool
    created_at: Union[Unset, datetime.datetime] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        transitioning = self.transitioning

        terminating = self.terminating

        created_at: Union[Unset, str] = UNSET
        if not isinstance(self.created_at, Unset):
            created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "transitioning": transitioning,
                "terminating": terminating,
            }
        )
        if created_at is not UNSET:
            field_dict["createdAt"] = created_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        transitioning = d.pop("transitioning")

        terminating = d.pop("terminating")

        _created_at = d.pop("createdAt", UNSET)
        created_at: Union[Unset, datetime.datetime]
        if isinstance(_created_at, Unset):
            created_at = UNSET
        else:
            created_at = isoparse(_created_at)

        rig_instance = cls(
            id=id,
            transitioning=transitioning,
            terminating=terminating,
            created_at=created_at,
        )

        rig_instance.additional_properties = d
        return rig_instance

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
