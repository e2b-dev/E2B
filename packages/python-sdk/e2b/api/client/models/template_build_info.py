from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.template_build_status import TemplateBuildStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.build_log_entry import BuildLogEntry
    from ..models.build_status_reason import BuildStatusReason


T = TypeVar("T", bound="TemplateBuildInfo")


@_attrs_define
class TemplateBuildInfo:
    """
    Attributes:
        logs (list[str]): Build logs
        log_entries (list['BuildLogEntry']): Build logs structured
        template_id (str): Identifier of the template
        build_id (str): Identifier of the build
        status (TemplateBuildStatus): Status of the template build
        reason (Union[Unset, BuildStatusReason]):
    """

    logs: list[str]
    log_entries: list["BuildLogEntry"]
    template_id: str
    build_id: str
    status: TemplateBuildStatus
    reason: Union[Unset, "BuildStatusReason"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        logs = self.logs

        log_entries = []
        for log_entries_item_data in self.log_entries:
            log_entries_item = log_entries_item_data.to_dict()
            log_entries.append(log_entries_item)

        template_id = self.template_id

        build_id = self.build_id

        status = self.status.value

        reason: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "logs": logs,
                "logEntries": log_entries,
                "templateID": template_id,
                "buildID": build_id,
                "status": status,
            }
        )
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.build_log_entry import BuildLogEntry
        from ..models.build_status_reason import BuildStatusReason

        d = dict(src_dict)
        logs = cast(list[str], d.pop("logs"))

        log_entries = []
        _log_entries = d.pop("logEntries")
        for log_entries_item_data in _log_entries:
            log_entries_item = BuildLogEntry.from_dict(log_entries_item_data)

            log_entries.append(log_entries_item)

        template_id = d.pop("templateID")

        build_id = d.pop("buildID")

        status = TemplateBuildStatus(d.pop("status"))

        _reason = d.pop("reason", UNSET)
        reason: Union[Unset, BuildStatusReason]
        if isinstance(_reason, Unset):
            reason = UNSET
        else:
            reason = BuildStatusReason.from_dict(_reason)

        template_build_info = cls(
            logs=logs,
            log_entries=log_entries,
            template_id=template_id,
            build_id=build_id,
            status=status,
            reason=reason,
        )

        template_build_info.additional_properties = d
        return template_build_info

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
