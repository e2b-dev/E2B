from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="LifecycleConfig")


@_attrs_define
class LifecycleConfig:
    """
    Attributes:
        on_timeout (str): What should happen when timeout is reached. Allowed values: "kill" or "pause".
        resume_on (Union[Unset, str]): Under what condition the paused sandbox should resume. Allowed values: "off" or
            "any".
    """

    on_timeout: str
    resume_on: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        on_timeout = self.on_timeout

        resume_on = self.resume_on

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "onTimeout": on_timeout,
            }
        )
        if resume_on is not UNSET:
            field_dict["resumeOn"] = resume_on

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        on_timeout = d.pop("onTimeout")

        resume_on = d.pop("resumeOn", UNSET)

        lifecycle_config = cls(
            on_timeout=on_timeout,
            resume_on=resume_on,
        )

        lifecycle_config.additional_properties = d
        return lifecycle_config

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
