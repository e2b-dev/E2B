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
        name (str):
        type_ (VolumeEntryStatType):
        path (str):
        size (int):
        mode (int):
        uid (int):
        gid (int):
        atime (datetime.datetime):
        mtime (datetime.datetime):
        ctime (datetime.datetime):
        target (Union[Unset, str]):
    """

    name: str
    type_: VolumeEntryStatType
    path: str
    size: int
    mode: int
    uid: int
    gid: int
    atime: datetime.datetime
    mtime: datetime.datetime
    ctime: datetime.datetime
    target: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        type_ = self.type_.value

        path = self.path

        size = self.size

        mode = self.mode

        uid = self.uid

        gid = self.gid

        atime = self.atime.isoformat()

        mtime = self.mtime.isoformat()

        ctime = self.ctime.isoformat()

        target = self.target

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "type": type_,
                "path": path,
                "size": size,
                "mode": mode,
                "uid": uid,
                "gid": gid,
                "atime": atime,
                "mtime": mtime,
                "ctime": ctime,
            }
        )
        if target is not UNSET:
            field_dict["target"] = target

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        type_ = VolumeEntryStatType(d.pop("type"))

        path = d.pop("path")

        size = d.pop("size")

        mode = d.pop("mode")

        uid = d.pop("uid")

        gid = d.pop("gid")

        atime = isoparse(d.pop("atime"))

        mtime = isoparse(d.pop("mtime"))

        ctime = isoparse(d.pop("ctime"))

        target = d.pop("target", UNSET)

        volume_entry_stat = cls(
            name=name,
            type_=type_,
            path=path,
            size=size,
            mode=mode,
            uid=uid,
            gid=gid,
            atime=atime,
            mtime=mtime,
            ctime=ctime,
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
