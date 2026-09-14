from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, Union

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.template_build_file_upload_headers import (
        TemplateBuildFileUploadHeaders,
    )


T = TypeVar("T", bound="TemplateBuildFileUpload")


@_attrs_define
class TemplateBuildFileUpload:
    """
    Attributes:
        present (bool): Whether the file is already present in the cache
        url (Union[Unset, str]): Url where the file should be uploaded to
        headers (Union[Unset, TemplateBuildFileUploadHeaders]): Request headers that must be sent with the upload
            request
    """

    present: bool
    url: Union[Unset, str] = UNSET
    headers: Union[Unset, "TemplateBuildFileUploadHeaders"] = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        present = self.present

        url = self.url

        headers: Union[Unset, dict[str, Any]] = UNSET
        if not isinstance(self.headers, Unset):
            headers = self.headers.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "present": present,
            }
        )
        if url is not UNSET:
            field_dict["url"] = url
        if headers is not UNSET:
            field_dict["headers"] = headers

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.template_build_file_upload_headers import (
            TemplateBuildFileUploadHeaders,
        )

        d = dict(src_dict)
        present = d.pop("present")

        url = d.pop("url", UNSET)

        _headers = d.pop("headers", UNSET)
        headers: Union[Unset, TemplateBuildFileUploadHeaders]
        if isinstance(_headers, Unset):
            headers = UNSET
        else:
            headers = TemplateBuildFileUploadHeaders.from_dict(_headers)

        template_build_file_upload = cls(
            present=present,
            url=url,
            headers=headers,
        )

        template_build_file_upload.additional_properties = d
        return template_build_file_upload

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
