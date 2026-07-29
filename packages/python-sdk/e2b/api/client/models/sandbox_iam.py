from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.sandbox_iam_tokens import SandboxIamTokens


T = TypeVar("T", bound="SandboxIam")


@_attrs_define
class SandboxIam:
    """Sandbox workload identity configuration. A non-empty, valid tokens map enables workload identity for the sandbox.

    Attributes:
        tokens (Union[Unset, SandboxIamTokens]): Named workload-token definitions, keyed by a caller-chosen token name.
    """

    tokens: Union[Unset, "SandboxIamTokens"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        tokens: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.tokens, Unset):
            tokens = self.tokens.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if tokens is not UNSET:
            field_dict["tokens"] = tokens

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sandbox_iam_tokens import SandboxIamTokens

        d = dict(src_dict)
        _tokens = d.pop("tokens", UNSET)
        tokens: Union[Unset, SandboxIamTokens]
        if isinstance(_tokens, Unset):
            tokens = UNSET
        else:
            tokens = SandboxIamTokens.from_dict(_tokens)

        sandbox_iam = cls(
            tokens=tokens,
        )

        sandbox_iam.additional_properties = d
        return sandbox_iam

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
