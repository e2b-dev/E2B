from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PatchVolumecontentVolumeIDPathBody")


@_attrs_define
class PatchVolumecontentVolumeIDPathBody:
    """
    Attributes:
        uid (Union[Unset, int]):
        gid (Union[Unset, int]):
        mode (Union[Unset, int]):
    """

    uid: Union[Unset, int] = UNSET
    gid: Union[Unset, int] = UNSET
    mode: Union[Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        uid = self.uid

        gid = self.gid

        mode = self.mode

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if uid is not UNSET:
            field_dict["uid"] = uid
        if gid is not UNSET:
            field_dict["gid"] = gid
        if mode is not UNSET:
            field_dict["mode"] = mode

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        uid = d.pop("uid", UNSET)

        gid = d.pop("gid", UNSET)

        mode = d.pop("mode", UNSET)

        patch_volumecontent_volume_id_path_body = cls(
            uid=uid,
            gid=gid,
            mode=mode,
        )

        patch_volumecontent_volume_id_path_body.additional_properties = d
        return patch_volumecontent_volume_id_path_body

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
