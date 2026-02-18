from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="PatchVolumesVolumeIDFileBody")


@_attrs_define
class PatchVolumesVolumeIDFileBody:
    """
    Attributes:
        gid (Union[Unset, int]):
        mode (Union[Unset, int]):
        uid (Union[Unset, int]):
    """

    gid: Union[Unset, int] = UNSET
    mode: Union[Unset, int] = UNSET
    uid: Union[Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        gid = self.gid

        mode = self.mode

        uid = self.uid

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if gid is not UNSET:
            field_dict["gid"] = gid
        if mode is not UNSET:
            field_dict["mode"] = mode
        if uid is not UNSET:
            field_dict["uid"] = uid

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        gid = d.pop("gid", UNSET)

        mode = d.pop("mode", UNSET)

        uid = d.pop("uid", UNSET)

        patch_volumes_volume_id_file_body = cls(
            gid=gid,
            mode=mode,
            uid=uid,
        )

        patch_volumes_volume_id_file_body.additional_properties = d
        return patch_volumes_volume_id_file_body

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
