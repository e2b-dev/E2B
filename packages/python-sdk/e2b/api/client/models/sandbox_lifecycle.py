from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.sandbox_on_timeout import SandboxOnTimeout

T = TypeVar("T", bound="SandboxLifecycle")


@_attrs_define
class SandboxLifecycle:
    """Sandbox lifecycle policy returned by sandbox info.

    Attributes:
        auto_resume (bool): Whether the sandbox can auto-resume.
        on_timeout (SandboxOnTimeout): Action taken when the sandbox times out.
    """

    auto_resume: bool
    on_timeout: SandboxOnTimeout
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        auto_resume = self.auto_resume

        on_timeout = self.on_timeout.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "autoResume": auto_resume,
                "onTimeout": on_timeout,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        auto_resume = d.pop("autoResume")

        on_timeout = SandboxOnTimeout(d.pop("onTimeout"))

        sandbox_lifecycle = cls(
            auto_resume=auto_resume,
            on_timeout=on_timeout,
        )

        sandbox_lifecycle.additional_properties = d
        return sandbox_lifecycle

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
