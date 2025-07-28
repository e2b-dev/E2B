from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="TemplateStep")


@_attrs_define
class TemplateStep:
    """Step in the template build process

    Attributes:
        type_ (str): Type of the step
        args (Union[Unset, list[str]]): Arguments for the step
        files_hash (Union[Unset, str]): Hash of the files used in the step
        force (Union[Unset, bool]): Whether the step should be forced to run regardless of the cache Default: False.
    """

    type_: str
    args: Union[Unset, list[str]] = UNSET
    files_hash: Union[Unset, str] = UNSET
    force: Union[Unset, bool] = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        args: Union[Unset, list[str]] = UNSET
        if not isinstance(self.args, Unset):
            args = self.args

        files_hash = self.files_hash

        force = self.force

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
            }
        )
        if args is not UNSET:
            field_dict["args"] = args
        if files_hash is not UNSET:
            field_dict["filesHash"] = files_hash
        if force is not UNSET:
            field_dict["force"] = force

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = d.pop("type")

        args = cast(list[str], d.pop("args", UNSET))

        files_hash = d.pop("filesHash", UNSET)

        force = d.pop("force", UNSET)

        template_step = cls(
            type_=type_,
            args=args,
            files_hash=files_hash,
            force=force,
        )

        template_step.additional_properties = d
        return template_step

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
