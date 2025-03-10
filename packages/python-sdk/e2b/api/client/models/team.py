from typing import Any, TypeVar, Optional, BinaryIO, TextIO, TYPE_CHECKING

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset


T = TypeVar("T", bound="Team")


@_attrs_define
class Team:
    """
    Attributes:
        team_id (str): Identifier of the team
        name (str): Name of the team
        api_key (str): API key for the team
        is_default (bool): Whether the team is the default team
    """

    team_id: str
    name: str
    api_key: str
    is_default: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        team_id = self.team_id

        name = self.name

        api_key = self.api_key

        is_default = self.is_default

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "teamID": team_id,
                "name": name,
                "apiKey": api_key,
                "isDefault": is_default,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: dict[str, Any]) -> T:
        d = src_dict.copy()
        team_id = d.pop("teamID")

        name = d.pop("name")

        api_key = d.pop("apiKey")

        is_default = d.pop("isDefault")

        team = cls(
            team_id=team_id,
            name=name,
            api_key=api_key,
            is_default=is_default,
        )

        team.additional_properties = d
        return team

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
