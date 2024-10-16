from typing import Any, Dict, List, Type, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="PostSandboxesSandboxIDTimeoutBody")


@_attrs_define
class PostSandboxesSandboxIDTimeoutBody:
    """
    Attributes:
        timeout (int): Timeout in seconds from the current time after which the sandbox should expire
    """

    timeout: int
    additional_properties: Dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        timeout = self.timeout

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "timeout": timeout,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        timeout = d.pop("timeout")

        post_sandboxes_sandbox_id_timeout_body = cls(
            timeout=timeout,
        )

        post_sandboxes_sandbox_id_timeout_body.additional_properties = d
        return post_sandboxes_sandbox_id_timeout_body

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
