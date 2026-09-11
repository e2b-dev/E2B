from collections.abc import Mapping
from typing import Any, TypeVar, Union, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.sidecar_info_class import SidecarInfoClass
from ..models.sidecar_info_role import SidecarInfoRole
from ..models.sidecar_info_state import SidecarInfoState
from ..types import UNSET, Unset

T = TypeVar("T", bound="SidecarInfo")


@_attrs_define
class SidecarInfo:
    """A sidecar attached to the sandbox and its current state.

    Attributes:
        entry (str): Catalog entry name
        version (str): Catalog entry version
        role (SidecarInfoRole): Role of the sidecar
        class_ (SidecarInfoClass): Lifecycle class of the sidecar
        state (SidecarInfoState): Current state of the sidecar
        name (str): Name the sandbox reaches the sidecar at ("{entry}.sidecar.e2b.local")
        address (Union[Unset, str]): Address of the sidecar inside the sandbox network
        ports (Union[Unset, list[int]]): Ports the sidecar listens on
        last_error (Union[Unset, str]): Last error of the sidecar, set when the state is failed
    """

    entry: str
    version: str
    role: SidecarInfoRole
    class_: SidecarInfoClass
    state: SidecarInfoState
    name: str
    address: Union[Unset, str] = UNSET
    ports: Union[Unset, list[int]] = UNSET
    last_error: Union[Unset, str] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        entry = self.entry

        version = self.version

        role = self.role.value

        class_ = self.class_.value

        state = self.state.value

        name = self.name

        address = self.address

        ports: Union[Unset, list[int]] = UNSET
        if not isinstance(self.ports, Unset):
            ports = self.ports

        last_error = self.last_error

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "entry": entry,
                "version": version,
                "role": role,
                "class": class_,
                "state": state,
                "name": name,
            }
        )
        if address is not UNSET:
            field_dict["address"] = address
        if ports is not UNSET:
            field_dict["ports"] = ports
        if last_error is not UNSET:
            field_dict["lastError"] = last_error

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        entry = d.pop("entry")

        version = d.pop("version")

        role = SidecarInfoRole(d.pop("role"))

        class_ = SidecarInfoClass(d.pop("class"))

        state = SidecarInfoState(d.pop("state"))

        name = d.pop("name")

        address = d.pop("address", UNSET)

        ports = cast(list[int], d.pop("ports", UNSET))

        last_error = d.pop("lastError", UNSET)

        sidecar_info = cls(
            entry=entry,
            version=version,
            role=role,
            class_=class_,
            state=state,
            name=name,
            address=address,
            ports=ports,
            last_error=last_error,
        )

        sidecar_info.additional_properties = d
        return sidecar_info

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
