import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

T = TypeVar("T", bound="RigError")


@_attrs_define
class RigError:
    """Scaling error on the rig's scaling group, e.g. a failed instance creation due to resource exhaustion

    Attributes:
        timestamp (datetime.datetime): When the error occurred
        code (str): Provider-specific error code (e.g. ZONE_RESOURCE_POOL_EXHAUSTED, Failed)
        message (str): Human-readable error message
        instance (Union[Unset, str]): Instance the error relates to, if any
        action (Union[Unset, str]): Action being performed when the error occurred (e.g. CREATING)
    """

    timestamp: datetime.datetime
    code: str
    message: str
    instance: Union[Unset, str] = UNSET
    action: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        timestamp = self.timestamp.isoformat()

        code = self.code

        message = self.message

        instance = self.instance

        action = self.action

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timestamp": timestamp,
                "code": code,
                "message": message,
            }
        )
        if instance is not UNSET:
            field_dict["instance"] = instance
        if action is not UNSET:
            field_dict["action"] = action

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        timestamp = isoparse(d.pop("timestamp"))

        code = d.pop("code")

        message = d.pop("message")

        instance = d.pop("instance", UNSET)

        action = d.pop("action", UNSET)

        rig_error = cls(
            timestamp=timestamp,
            code=code,
            message=message,
            instance=instance,
            action=action,
        )

        rig_error.additional_properties = d
        return rig_error

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
