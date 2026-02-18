import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..models.volume_entry_stat_type import VolumeEntryStatType
from ..types import UNSET, Unset

T = TypeVar("T", bound="VolumeEntryStat")


@_attrs_define
class VolumeEntryStat:
    """
    Attributes:
        ctime (datetime.datetime):
        gid (int):
        mode (int):
        mtime (datetime.datetime):
        name (str):
        path (str):
        size (int):
        type_ (VolumeEntryStatType):
        uid (int):
        target (Union[Unset, str]):
    """

    ctime: datetime.datetime
    gid: int
    mode: int
    mtime: datetime.datetime
    name: str
    path: str
    size: int
    type_: VolumeEntryStatType
    uid: int
    target: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        ctime = self.ctime.isoformat()

        gid = self.gid

        mode = self.mode

        mtime = self.mtime.isoformat()

        name = self.name

        path = self.path

        size = self.size

        type_ = self.type_.value

        uid = self.uid

        target = self.target

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "ctime": ctime,
                "gid": gid,
                "mode": mode,
                "mtime": mtime,
                "name": name,
                "path": path,
                "size": size,
                "type": type_,
                "uid": uid,
            }
        )
        if target is not UNSET:
            field_dict["target"] = target

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ctime = isoparse(d.pop("ctime"))

        gid = d.pop("gid")

        mode = d.pop("mode")

        mtime = isoparse(d.pop("mtime"))

        name = d.pop("name")

        path = d.pop("path")

        size = d.pop("size")

        type_ = VolumeEntryStatType(d.pop("type"))

        uid = d.pop("uid")

        target = d.pop("target", UNSET)

        volume_entry_stat = cls(
            ctime=ctime,
            gid=gid,
            mode=mode,
            mtime=mtime,
            name=name,
            path=path,
            size=size,
            type_=type_,
            uid=uid,
            target=target,
        )

        volume_entry_stat.additional_properties = d
        return volume_entry_stat

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
