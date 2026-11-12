import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field
from dateutil.parser import isoparse

from ..types import UNSET, Unset

T = TypeVar("T", bound="SandboxRecord")


@_attrs_define
class SandboxRecord:
    """
    Attributes:
        template_id (str): Identifier of the template from which is the sandbox created
        sandbox_id (str): Identifier of the sandbox
        started_at (datetime.datetime): Time when the sandbox was started
        cpu_count (int): CPU cores for the sandbox
        memory_mb (int): Memory for the sandbox in MiB
        disk_size_mb (int): Disk size for the sandbox in MiB
        retention_expired (bool): Whether the sandbox ended more than the fixed retention window ago, so its monitoring
            and logs data is no longer available
        events_retention_expired (bool): Whether the sandbox ended more than the team's events retention window ago, so
            its events data is no longer available
        alias (Union[Unset, str]): Alias of the template
        stopped_at (Union[None, Unset, datetime.datetime]): Time when the sandbox was stopped
        domain (Union[None, Unset, str]): Base domain where the sandbox traffic is accessible
    """

    template_id: str
    sandbox_id: str
    started_at: datetime.datetime
    cpu_count: int
    memory_mb: int
    disk_size_mb: int
    retention_expired: bool
    events_retention_expired: bool
    alias: Union[Unset, str] = UNSET
    stopped_at: Union[None, Unset, datetime.datetime] = UNSET
    domain: Union[None, Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        template_id = self.template_id

        sandbox_id = self.sandbox_id

        started_at = self.started_at.isoformat()

        cpu_count = self.cpu_count

        memory_mb = self.memory_mb

        disk_size_mb = self.disk_size_mb

        retention_expired = self.retention_expired

        events_retention_expired = self.events_retention_expired

        alias = self.alias

        stopped_at: Union[None, Unset, str]
        if isinstance(self.stopped_at, Unset):
            stopped_at = UNSET
        elif isinstance(self.stopped_at, datetime.datetime):
            stopped_at = self.stopped_at.isoformat()
        else:
            stopped_at = self.stopped_at

        domain: Union[None, Unset, str]
        if isinstance(self.domain, Unset):
            domain = UNSET
        else:
            domain = self.domain

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "templateID": template_id,
                "sandboxID": sandbox_id,
                "startedAt": started_at,
                "cpuCount": cpu_count,
                "memoryMB": memory_mb,
                "diskSizeMB": disk_size_mb,
                "retentionExpired": retention_expired,
                "eventsRetentionExpired": events_retention_expired,
            }
        )
        if alias is not UNSET:
            field_dict["alias"] = alias
        if stopped_at is not UNSET:
            field_dict["stoppedAt"] = stopped_at
        if domain is not UNSET:
            field_dict["domain"] = domain

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        template_id = d.pop("templateID")

        sandbox_id = d.pop("sandboxID")

        started_at = isoparse(d.pop("startedAt"))

        cpu_count = d.pop("cpuCount")

        memory_mb = d.pop("memoryMB")

        disk_size_mb = d.pop("diskSizeMB")

        retention_expired = d.pop("retentionExpired")

        events_retention_expired = d.pop("eventsRetentionExpired")

        alias = d.pop("alias", UNSET)

        def _parse_stopped_at(data: object) -> Union[None, Unset, datetime.datetime]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                stopped_at_type_0 = isoparse(data)

                return stopped_at_type_0
            except:  # noqa: E722
                pass
            return cast(Union[None, Unset, datetime.datetime], data)

        stopped_at = _parse_stopped_at(d.pop("stoppedAt", UNSET))

        def _parse_domain(data: object) -> Union[None, Unset, str]:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Union[None, Unset, str], data)

        domain = _parse_domain(d.pop("domain", UNSET))

        sandbox_record = cls(
            template_id=template_id,
            sandbox_id=sandbox_id,
            started_at=started_at,
            cpu_count=cpu_count,
            memory_mb=memory_mb,
            disk_size_mb=disk_size_mb,
            retention_expired=retention_expired,
            events_retention_expired=events_retention_expired,
            alias=alias,
            stopped_at=stopped_at,
            domain=domain,
        )

        sandbox_record.additional_properties = d
        return sandbox_record

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
