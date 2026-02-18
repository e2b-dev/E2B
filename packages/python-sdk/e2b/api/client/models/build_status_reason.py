from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.build_log_entry import BuildLogEntry


T = TypeVar("T", bound="BuildStatusReason")


@_attrs_define
class BuildStatusReason:
    """
    Attributes:
        message (str): Message with the status reason, currently reporting only for error status
        log_entries (Union[Unset, list['BuildLogEntry']]): Log entries related to the status reason
        step (Union[Unset, str]): Step that failed
    """

    message: str
    log_entries: Union[Unset, list["BuildLogEntry"]] = UNSET
    step: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        message = self.message

        log_entries: Union[Unset, list[dict[str, Any]]] = UNSET
        if not isinstance(self.log_entries, Unset):
            log_entries = []
            for log_entries_item_data in self.log_entries:
                log_entries_item = log_entries_item_data.to_dict()
                log_entries.append(log_entries_item)

        step = self.step

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "message": message,
            }
        )
        if log_entries is not UNSET:
            field_dict["logEntries"] = log_entries
        if step is not UNSET:
            field_dict["step"] = step

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.build_log_entry import BuildLogEntry

        d = dict(src_dict)
        message = d.pop("message")

        log_entries = []
        _log_entries = d.pop("logEntries", UNSET)
        for log_entries_item_data in _log_entries or []:
            log_entries_item = BuildLogEntry.from_dict(log_entries_item_data)

            log_entries.append(log_entries_item)

        step = d.pop("step", UNSET)

        build_status_reason = cls(
            message=message,
            log_entries=log_entries,
            step=step,
        )

        build_status_reason.additional_properties = d
        return build_status_reason

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
