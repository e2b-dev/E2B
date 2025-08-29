from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PostSandboxesSandboxIDCpusBody")


@_attrs_define
class PostSandboxesSandboxIDCpusBody:
    """
    Attributes:
        online_cpus (int): Number of vcpus to make online
    """

    online_cpus: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        online_cpus = self.online_cpus

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "onlineCpus": online_cpus,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        online_cpus = d.pop("onlineCpus")

        post_sandboxes_sandbox_id_cpus_body = cls(
            online_cpus=online_cpus,
        )

        post_sandboxes_sandbox_id_cpus_body.additional_properties = d
        return post_sandboxes_sandbox_id_cpus_body

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
