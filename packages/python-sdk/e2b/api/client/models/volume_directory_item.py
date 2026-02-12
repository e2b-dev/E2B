import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

T = TypeVar("T", bound="VolumeDirectoryItem")


@_attrs_define
class VolumeDirectoryItem:
    """
    Attributes:
        ctime (Union[Unset, datetime.datetime]): Create time of the file or directory
        is_directory (Union[Unset, bool]): Whether the item is a directory
        mode (Union[Unset, int]): File mode
        mtime (Union[Unset, datetime.datetime]): Last modification time of the file or directory
        name (Union[Unset, str]): Name of the file or directory
        size (Union[Unset, int]): File size in bytes
    """

    ctime: Union[Unset, datetime.datetime] = UNSET
    is_directory: Union[Unset, bool] = UNSET
    mode: Union[Unset, int] = UNSET
    mtime: Union[Unset, datetime.datetime] = UNSET
    name: Union[Unset, str] = UNSET
    size: Union[Unset, int] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        ctime: Union[Unset, str] = UNSET
        if not isinstance(self.ctime, Unset):
            ctime = self.ctime.isoformat()

        is_directory = self.is_directory

        mode = self.mode

        mtime: Union[Unset, str] = UNSET
        if not isinstance(self.mtime, Unset):
            mtime = self.mtime.isoformat()

        name = self.name

        size = self.size

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if ctime is not UNSET:
            field_dict["ctime"] = ctime
        if is_directory is not UNSET:
            field_dict["isDirectory"] = is_directory
        if mode is not UNSET:
            field_dict["mode"] = mode
        if mtime is not UNSET:
            field_dict["mtime"] = mtime
        if name is not UNSET:
            field_dict["name"] = name
        if size is not UNSET:
            field_dict["size"] = size

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _ctime = d.pop("ctime", UNSET)
        ctime: Union[Unset, datetime.datetime]
        if isinstance(_ctime, Unset):
            ctime = UNSET
        else:
            ctime = isoparse(_ctime)

        is_directory = d.pop("isDirectory", UNSET)

        mode = d.pop("mode", UNSET)

        _mtime = d.pop("mtime", UNSET)
        mtime: Union[Unset, datetime.datetime]
        if isinstance(_mtime, Unset):
            mtime = UNSET
        else:
            mtime = isoparse(_mtime)

        name = d.pop("name", UNSET)

        size = d.pop("size", UNSET)

        volume_directory_item = cls(
            ctime=ctime,
            is_directory=is_directory,
            mode=mode,
            mtime=mtime,
            name=name,
            size=size,
        )

        volume_directory_item.additional_properties = d
        return volume_directory_item

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
