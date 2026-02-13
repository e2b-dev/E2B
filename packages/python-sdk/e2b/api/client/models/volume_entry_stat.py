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
        group (int):
        mode (int):
        mtime (datetime.datetime):
        name (str):
        owner (int):
        path (str):
        size (int):
        type_ (VolumeEntryStatType):
        target (Union[Unset, str]):
    """

    ctime: datetime.datetime
    group: int
    mode: int
    mtime: datetime.datetime
    name: str
    owner: int
    path: str
    size: int
    type_: VolumeEntryStatType
    target: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        ctime = self.ctime.isoformat()

        group = self.group

        mode = self.mode

        mtime = self.mtime.isoformat()

        name = self.name

        owner = self.owner

        path = self.path

        size = self.size

        type_ = self.type_.value

        target = self.target

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "ctime": ctime,
                "group": group,
                "mode": mode,
                "mtime": mtime,
                "name": name,
                "owner": owner,
                "path": path,
                "size": size,
                "type": type_,
            }
        )
        if target is not UNSET:
            field_dict["target"] = target

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        ctime = isoparse(d.pop("ctime"))

        group = d.pop("group")

        mode = d.pop("mode")

        mtime = isoparse(d.pop("mtime"))

        name = d.pop("name")

        owner = d.pop("owner")

        path = d.pop("path")

        size = d.pop("size")

        type_ = VolumeEntryStatType(d.pop("type"))

        target = d.pop("target", UNSET)

        volume_entry_stat = cls(
            ctime=ctime,
            group=group,
            mode=mode,
            mtime=mtime,
            name=name,
            owner=owner,
            path=path,
            size=size,
            type_=type_,
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
