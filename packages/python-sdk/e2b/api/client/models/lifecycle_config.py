from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.lifecycle_config_on_timeout import LifecycleConfigOnTimeout
from ..models.lifecycle_config_resume_on import LifecycleConfigResumeOn
from ..types import UNSET, Unset

T = TypeVar("T", bound="LifecycleConfig")


@_attrs_define
class LifecycleConfig:
    """
    Attributes:
        on_timeout (LifecycleConfigOnTimeout): What should happen when timeout is reached. Allowed values are "kill" or
            "pause".
        resume_on (Union[Unset, LifecycleConfigResumeOn]): Under what condition the paused sandbox should resume.
            Allowed values are "off" or "any". Can be "any" only when onTimeout is "pause".
    """

    on_timeout: LifecycleConfigOnTimeout
    resume_on: Union[Unset, LifecycleConfigResumeOn] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        on_timeout = self.on_timeout.value

        resume_on: Union[Unset, str] = UNSET
        if not isinstance(self.resume_on, Unset):
            resume_on = self.resume_on.value

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
        on_timeout = LifecycleConfigOnTimeout(d.pop("onTimeout"))

        _resume_on = d.pop("resumeOn", UNSET)
        resume_on: Union[Unset, LifecycleConfigResumeOn]
        if isinstance(_resume_on, Unset):
            resume_on = UNSET
        else:
            resume_on = LifecycleConfigResumeOn(_resume_on)

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
